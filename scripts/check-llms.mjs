/**
 * Checks the machine-readable index and the skill marketplace.
 *
 * Two artefacts nobody in this repository reads, which is exactly why they rot:
 * `llms.txt` is fetched by a model deciding how to use this framework, and
 * `.claude-plugin/marketplace.json` is read by `/plugin marketplace add`. A dead
 * link in either is invisible here and total for whoever followed it.
 *
 * The canon is `skills/documentation/SKILL.md`; this is the half that can fail.
 *
 * Run: node scripts/check-llms.mjs
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PACKAGES, pkgDir, pkgName } from "./registry.mjs";
import { linkedPaths, namedPackages, renderLlmsIndex } from "./llms.mjs";
import { currentVersion } from "./skills.mjs";
import { readSurface } from "./check-api.mjs";

const ROOT = process.cwd();

/** Every problem the index can have, as one list. */
export const indexDivergences = (text, present = (path) => existsSync(join(ROOT, path))) => {
	const problems = [];

	for (const path of linkedPaths(text)) {
		if (present(path)) continue;

		problems.push({
			tag: "llms-dead-link",
			where: path,
			message:
				"is linked from llms.txt and is not in the repository. A model follows the " +
				"link and gets a 404 — worse than an absent line, because the absent one " +
				"sends it to the next source.",
		});
	}

	const named = new Set(namedPackages(text));
	for (const pkg of PACKAGES) {
		if (named.has(pkgName(pkg))) continue;

		problems.push({
			tag: "llms-package-missing",
			where: pkgName(pkg),
			message:
				"publishes and is not in llms.txt, so the one index a model reads does " +
				"not know it exists. Regenerate with `node scripts/scaffold.mjs`.",
		});
	}

	return problems;
};

/** What a marketplace entry must actually have on disk to install. */
export const marketplaceDivergences = (
	manifest,
	present = (path) => existsSync(join(ROOT, path)),
) => {
	const problems = [];
	const seen = new Set();

	for (const plugin of manifest.plugins ?? []) {
		const dir = String(plugin.source).replace(/^\.\//, "");

		if (seen.has(plugin.name)) {
			problems.push({
				tag: "marketplace-duplicate",
				where: plugin.name,
				message:
					"is listed twice. `/plugin marketplace add` takes the first and hides the second.",
			});
		}
		seen.add(plugin.name);

		if (!present(`${dir}/.claude-plugin/plugin.json`)) {
			problems.push({
				tag: "marketplace-no-manifest",
				where: dir,
				message:
					"is listed as a plugin and has no `.claude-plugin/plugin.json`. The " +
					"marketplace resolves the directory, so an entry without one installs nothing.",
			});
		}

		if (!present(`${dir}/skills`)) {
			problems.push({
				tag: "marketplace-no-skills",
				where: dir,
				message:
					"is listed as a plugin and ships no `skills/`. An installed plugin that " +
					"teaches an agent nothing is a menu entry with no dish behind it.",
			});
		}
	}

	for (const pkg of PACKAGES) {
		const dir = pkgDir(pkg);
		if ((manifest.plugins ?? []).some((plugin) => String(plugin.source).endsWith(dir)))
			continue;

		problems.push({
			tag: "marketplace-package-missing",
			where: dir,
			message: "ships a skill and is not in the marketplace, so nobody can install it.",
		});
	}

	return problems;
};

/**
 * Branded tokens in a snippet that are not API names.
 *
 * The package, the npm scope, and the alias namespace an application publishes to
 * the framework. They appear in every import line and belong to no surface.
 */
export const NOT_API_NAMES = new Set(["lanka", "lankajs", "lanka_di"]);

/**
 * Any identifier CONTAINING the brand: what a reader will try to type.
 *
 * Not `\b[Ll]anka…`, which requires a word boundary before the brand and
 * therefore misses `createLankaVM` — most of what a factory is called here. The
 * first version of this rule read every snippet in twenty skills and found
 * nothing, which is what a check that cannot fail looks like from the outside.
 */
const BRANDED = /\b(\w*[Ll]anka\w*)\b/g;

/**
 * Names a shipped skill's examples use and the package does not publish.
 *
 * This is the whole promise of shipping a skill: an agent that loads it writes
 * code that compiles the first time. A snippet naming something absent produces
 * the opposite — code that looks idiomatic and does not exist — and it is worse
 * than no skill, because the reader trusts it.
 *
 * Only fenced blocks are read. Prose says `ALankaX` to mean "any role" and points
 * at names in neighbouring packages; a snippet is what gets copied.
 */
export const skillDivergences = (skills, published) => {
	const problems = [];

	for (const { file, text } of skills) {
		for (const [, block] of text.matchAll(/```[a-z]*\n([\s\S]*?)```/g)) {
			for (const [, name] of block.matchAll(BRANDED)) {
				if (published.has(name) || NOT_API_NAMES.has(name)) continue;

				problems.push({
					tag: "skill-teaches-unknown-name",
					where: `${file} → ${name}`,
					message:
						"appears in an example and is published by no package. An agent that " +
						"loaded this skill writes it, the consumer's build fails, and the skill " +
						"was worse than nothing. Fix the example or publish the name.",
				});
			}
		}
	}

	return problems;
};

/** Every shipped skill, as text. */
const shippedSkills = () => {
	const found = [];

	for (const pkg of PACKAGES) {
		const root = join(ROOT, pkgDir(pkg), "skills");
		if (!existsSync(root)) continue;

		for (const name of readdirSync(root)) {
			const rel = `${pkgDir(pkg)}/skills/${name}/SKILL.md`;
			if (!existsSync(join(ROOT, rel))) continue;
			found.push({ file: rel, text: readFileSync(join(ROOT, rel), "utf8") });
		}
	}

	return found;
};

/** Every name any package publishes, read through the surface reader. */
const publishedNames = () => {
	const names = new Set();

	for (const pkg of PACKAGES) {
		for (const entry of readSurface(pkg)) {
			for (const item of entry.exports) names.add(item.name);
		}
	}

	return names;
};

/** The index on disk against the index the generator would write now. */
export const staleIndex = (onDisk, generated) =>
	onDisk === generated
		? []
		: [
				{
					tag: "llms-stale",
					where: "llms.txt",
					message:
						"differs from what the generator writes. Run `node scripts/scaffold.mjs`: " +
						"the version, the package list and the links all come from the registry.",
				},
			];

/** The version the index claims against the version the packages carry. */
export const versionDivergences = (text, version = currentVersion("core")) =>
	text.includes(`Core version ${version};`)
		? []
		: [
				{
					tag: "llms-version",
					where: "llms.txt",
					message:
						`does not name core version ${version}. A model that cites a guide for the ` +
						"wrong version writes code against an API the reader does not have. The " +
						"nineteen packages version independently, so the index names the core and " +
						"sends the reader to each document for its own.",
				},
			];

const problems = [];

export const run = () => {
	problems.length = 0;

	const path = join(ROOT, "llms.txt");
	if (!existsSync(path)) {
		problems.push({
			tag: "llms-missing",
			where: "llms.txt",
			message: "does not exist. Run `node scripts/scaffold.mjs`.",
		});
		return problems;
	}

	const text = readFileSync(path, "utf8");
	problems.push(...staleIndex(text, renderLlmsIndex()));
	problems.push(...versionDivergences(text));
	problems.push(...indexDivergences(text));
	problems.push(...skillDivergences(shippedSkills(), publishedNames()));
	problems.push(
		...marketplaceDivergences(
			JSON.parse(readFileSync(join(ROOT, ".claude-plugin/marketplace.json"), "utf8")),
		),
	);

	return problems;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	run();

	if (problems.length > 0) {
		console.error(
			`X WHAT A MACHINE READS DIVERGES (${String(problems.length)})\n\n` +
				problems.map((p) => `[${p.tag}] ${p.where}\n    ${p.message}`).join("\n\n") +
				"\n\nCanon: skills/documentation/SKILL.md",
		);
		process.exit(1);
	}

	const links = linkedPaths(readFileSync(join(ROOT, "llms.txt"), "utf8")).length;
	console.log(
		`x a machine can read this repository: llms.txt names ${String(PACKAGES.length)} packages ` +
			`and ${String(links)} live documents; ${String(shippedSkills().length)} shipped skills teach only names that exist; ` +
			`the marketplace lists ${String(PACKAGES.length)} installable plugins`,
	);
}
