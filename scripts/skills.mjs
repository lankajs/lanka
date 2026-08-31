/**
 * Packages each package's consumer skill for the two ways a user installs one.
 *
 * ## What a consumer skill is, and what it is not
 *
 * Three things in this repository are called a skill, and they have three
 * different readers:
 *
 * - `skills/<rule>/SKILL.md` — the repository's own canon. Never shipped.
 * - `<pkg>/SKILL.md` — how to MAINTAIN that package. Never shipped.
 * - `<pkg>/skills/lanka-<slug>/SKILL.md` — how an agent should USE the package
 *   in somebody else's application. This is the only one that ships, and it is
 *   the one this script packages.
 *
 * ## What is generated and what is written by hand
 *
 * The skill itself is HAND-WRITTEN: it is the decision procedure, the shapes and
 * the refusals, and none of that can be derived from a document written for a
 * person reading top to bottom.
 *
 * What this script generates is everything around it — `reference.md`, which is
 * the package's `GUIDE.md` verbatim so the skill directory is self-contained on
 * npm as well as in git; the plugin manifest that makes the package directory a
 * Claude Code plugin; and the marketplace that lists all of them. Generated, so
 * `check:drift` keeps them equal to their source.
 *
 * Run: node scripts/scaffold.mjs (this runs as part of it)
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ORIGIN, PACKAGES, pkgDir, pkgName } from "./registry.mjs";

const ROOT = process.cwd();

const write = (rel, text) => {
	const full = join(ROOT, rel);
	mkdirSync(dirname(full), { recursive: true });
	writeFileSync(full, text, "utf8");
};

/**
 * The name a consumer sees, in their skill list and in `/plugin install`.
 *
 * `lanka-<slug>`, with core as `lanka-core`: the npm name `lanka` would read as
 * "the whole framework" in a list where every other entry is one package, and a
 * skill list is exactly where that distinction has to survive.
 */
export const skillName = (p) => `lanka-${p.slug}`;

/** Where the shipped skill lives, inside the package it belongs to. */
export const skillDir = (p) => `${pkgDir(p)}/skills/${skillName(p)}`;

/** The marketplace, at the repository root, listing every package's plugin. */
export const MARKETPLACE_PATH = ".claude-plugin/marketplace.json";

/**
 * The plugin manifest that turns a package directory into an installable plugin.
 *
 * The package directory IS the plugin: its `skills/` folder is what Claude Code
 * loads, and the marketplace points at the directory. One layout serves both
 * transports, so there is no second copy of a skill to keep in step.
 */
const pluginManifest = (p) => ({
	name: skillName(p),
	description: `${pkgName(p)} — ${p.gist}`,
	version: "0.0.0",
	author: { name: ORIGIN.owner },
	homepage: `${ORIGIN.repository}/tree/main/${pkgDir(p)}`,
	repository: ORIGIN.repository,
	license: "MIT",
	keywords: ["lanka", "react", p.kind],
});

const marketplace = () => ({
	name: "lanka",
	owner: { name: ORIGIN.owner, url: `https://github.com/${ORIGIN.owner}` },
	metadata: {
		description: "Agent skills for the lanka framework — one plugin per package.",
		version: "0.0.0",
	},
	plugins: PACKAGES.map((p) => ({
		name: skillName(p),
		source: `./${pkgDir(p)}`,
		description: `${pkgName(p)} — ${p.gist}`,
	})),
});

/**
 * The guide, copied beside the skill that points at it.
 *
 * A copy rather than a link across directories: a skill installed from npm has
 * only its own folder, and one that references a file it did not ship reads as
 * a broken pointer at exactly the moment somebody needs the detail.
 */
/** `a/b` + `../c` → `a/c`, without touching the file system. */
const posixResolve = (from, target) => {
	const parts = from.split("/");
	for (const segment of target.split("/")) {
		if (segment === "..") parts.pop();
		else if (segment !== ".") parts.push(segment);
	}
	return parts.join("/");
};

/**
 * Rewrites the guide's relative links to point at the repository.
 *
 * The copy sits two directories below its source, so every `./SKILL.md` and
 * `../../README.md` in it already resolves to nothing — and inside an npm
 * tarball those files are not shipped at all, so no relative path could work.
 * An absolute link is the only form that resolves for every reader of this
 * file: on GitHub, in a consumer's `node_modules`, and in an agent's context.
 *
 * In-page anchors are left alone; they are the one relative form that survives
 * the move.
 */
const absoluteLinks = (markdown, dir) =>
	markdown.replace(/\]\((\.{1,2}\/[^)\s]+)\)/g, (whole, target) => {
		const [path, anchor] = target.split("#");
		const resolved = posixResolve(dir, path);
		return `](${ORIGIN.repository}/blob/main/${resolved}${anchor ? `#${anchor}` : ""})`;
	});

const reference = (p) => {
	const guide = join(ROOT, pkgDir(p), "GUIDE.md");
	if (!existsSync(guide)) return null;

	return (
		`<!-- Generated from ${pkgDir(p)}/GUIDE.md by scripts/skills.mjs. Edit the guide. -->\n\n` +
		absoluteLinks(readFileSync(guide, "utf8"), pkgDir(p))
	);
};

/**
 * The frontmatter keys a skill does not get to write for itself.
 *
 * `name` and `description` are the skill's own: the description is the trigger,
 * and only whoever wrote the body knows when it should be loaded. Everything
 * else states which package the skill belongs to and under what terms, and that
 * is the registry's to say — a version maintained by hand in eighteen files is
 * eighteen chances to be wrong about one number.
 */
const frontmatterProvenance = (p) => [
	"license: MIT",
	"metadata:",
	// Four spaces, not two: prettier formats a markdown file's frontmatter with
	// the repository's `tabWidth`, and a two-space block would be rewritten on the
	// next format run — after which the scaffolder would rewrite it back. The one
	// file with two owners is the one that is never quiet.
	`    author: ${ORIGIN.owner}`,
	`    package: ${pkgName(p)}`,
	'    version: "0.0.0"',
];

/** Everything the author wrote, minus the keys this script owns. */
const authoredFrontmatter = (lines) => {
	const kept = [];
	let inProvenance = false;

	for (const line of lines) {
		if (/^(license|metadata):/.test(line)) {
			inProvenance = line.startsWith("metadata:");
			continue;
		}
		// A block key's contents are its indented continuation lines.
		if (inProvenance && /^\s+\S/.test(line)) continue;
		inProvenance = false;
		kept.push(line);
	}

	return kept;
};

/**
 * Rewrites a skill's provenance keys, leaving its body and its trigger alone.
 *
 * Half-generated on purpose. The alternative — generating the whole file — would
 * mean deriving a decision procedure from a document written to be read top to
 * bottom, and the alternative to that is eighteen hand-kept version numbers.
 */
const stampSkill = (p, rel) => {
	const source = readFileSync(join(ROOT, rel), "utf8");
	const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
	if (!match) return false;

	const authored = authoredFrontmatter(match[1].split("\n"));
	const stamped = `---\n${[...authored, ...frontmatterProvenance(p)].join("\n")}\n---\n`;

	write(rel, stamped + source.slice(match[0].length));
	return true;
};

export function generateSkillPackaging() {
	const missing = [];
	const unstamped = [];

	for (const p of PACKAGES) {
		write(
			`${pkgDir(p)}/.claude-plugin/plugin.json`,
			`${JSON.stringify(pluginManifest(p), null, "\t")}\n`,
		);

		const skillsRoot = join(ROOT, pkgDir(p), "skills");
		if (existsSync(skillsRoot)) {
			for (const skill of readdirSync(skillsRoot)) {
				const rel = `${pkgDir(p)}/skills/${skill}/SKILL.md`;
				if (!existsSync(join(ROOT, rel))) continue;
				if (!stampSkill(p, rel)) unstamped.push(rel);
			}
		}

		const body = reference(p);
		if (body === null) {
			missing.push(pkgDir(p));
			continue;
		}
		write(`${skillDir(p)}/reference.md`, body);
	}

	if (unstamped.length > 0) {
		throw new Error(
			`a shipped skill has no frontmatter, so an agent cannot know when to load it:\n  ${unstamped.join("\n  ")}`,
		);
	}

	write(MARKETPLACE_PATH, `${JSON.stringify(marketplace(), null, "\t")}\n`);

	return { packages: PACKAGES.length, missingGuides: missing };
}
