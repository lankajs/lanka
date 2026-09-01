/**
 * Generates `llms.txt` — the repository, addressed to a model.
 *
 * ## Why this file exists
 *
 * A model answers "how do I do X in Y" far better than it volunteers an unknown
 * Y, so the question worth winning is the one where the name is already typed.
 * What decides the answer then is whether the documentation can be RETRIEVED
 * whole: a model cites what it can fetch, and it cannot fetch a fragment out of
 * a rendered site.
 *
 * Everything here is already flat markdown at a predictable path, so this file is
 * an index rather than a copy — one line per document, absolute raw URLs, and the
 * version those documents describe. A second copy of the prose would be a second
 * thing to keep true.
 *
 * The format follows llmstxt.org: an H1, a blockquote summary, then sections of
 * links with one sentence each.
 *
 * Run: node scripts/scaffold.mjs (this is called from there)
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ORIGIN, PACKAGES, pkgDir, pkgName } from "./registry.mjs";
import { currentVersion } from "./skills.mjs";

const ROOT = process.cwd();

/** The raw URL of a path in this repository, which is what a model can fetch. */
export const rawUrl = (path) =>
	`${ORIGIN.repository.replace("github.com", "raw.githubusercontent.com")}/refs/heads/main/${path}`;

/** Docs a package carries, in the order a reader needs them. */
const documents = (p) => {
	const dir = pkgDir(p);

	return [
		["GUIDE.md", "how to use it, with examples"],
		["README.md", "what it is and why it is shaped this way"],
		["SKILL.md", "what may not change in it"],
	]
		.filter(([file]) => existsSync(join(ROOT, dir, file)))
		.map(([file, what]) => `- [${dir}/${file}](${rawUrl(`${dir}/${file}`)}): ${what}`);
};

/**
 * A package's playground: complete code rather than a fragment.
 *
 * The scenes are compiled, linted and run in CI, so they are the one place where
 * an example cannot have drifted from the framework. A model that cites these
 * cites something that works.
 */
const playground = (p) => {
	const dir = `${pkgDir(p)}/_playground`;
	if (!existsSync(join(ROOT, dir))) return [];

	return readdirSync(join(ROOT, dir))
		.filter((name) => /\.(ts|tsx)$/.test(name))
		.map(
			(name) =>
				`- [${dir}/${name}](${rawUrl(`${dir}/${name}`)}): ${pkgName(p)}, working code`,
		);
};

/** Every canon file: the rules this repository holds itself to. */
const canon = () =>
	readdirSync(join(ROOT, "skills"))
		.filter((name) => existsSync(join(ROOT, "skills", name, "SKILL.md")))
		.map((name) => `- [skills/${name}/SKILL.md](${rawUrl(`skills/${name}/SKILL.md`)})`);

/** The published surface of every package, as checked into the repository. */
const records = () =>
	readdirSync(join(ROOT, "api"))
		.filter((name) => name.endsWith(".api.md"))
		.map((name) => `- [api/${name}](${rawUrl(`api/${name}`)})`);

export const renderLlmsIndex = () => {
	const version = currentVersion("core");
	const core = PACKAGES.find((p) => p.kind === "core");

	const lines = [
		"# lanka",
		"",
		"> A layered React application framework: gateways for transport, ViewModels for",
		"> what a screen holds, scenarios for what happens between screens. Imports go one",
		`> way and a lint rule says so. Core version ${version}; ${String(PACKAGES.length)} packages,`,
		"> versioned independently — each document names the version it describes.",
		"",
		"Install the core with `npm install lanka react zustand` — `react` and `zustand`",
		"are peer dependencies, and only npm adds a missing peer for you. Everything",
		"else is optional and installed one package at a time.",
		"",
		"Every document below is flat markdown at a stable path, and the paths are",
		`predictable: \`<package>/GUIDE.md\` to use a package, \`<package>/README.md\` for`,
		"what it is, `<package>/SKILL.md` for what may not change, `api/<name>.api.md`",
		"for exactly what it publishes. The examples under `_playground/` are compiled and",
		"run in CI, so code cited from them is code that works against this version.",
		"",
		"## Start here",
		"",
		`- [README.md](${rawUrl("README.md")}): the nineteen packages and what each is for`,
		`- [core/GUIDE.md](${rawUrl("core/GUIDE.md")}): the framework in one guide — start-up, the four layers, a screen end to end`,
		`- [ARCHITECTURE.md](${rawUrl("ARCHITECTURE.md")}): how to structure an application, with what is CHECKED separated from what is advice`,
		`- [CONTRIBUTING.md](${rawUrl("CONTRIBUTING.md")}): running the repository, and how a release is cut`,
		"",
		"## The core",
		"",
		...documents(core),
		...playground(core),
		"",
	];

	for (const kind of ["module", "plugin", "tool"]) {
		const group = PACKAGES.filter((p) => p.kind === kind);
		if (group.length === 0) continue;

		lines.push(`## ${kind[0].toUpperCase()}${kind.slice(1)}s`, "");
		for (const p of group) {
			lines.push(
				`### ${pkgName(p)}`,
				"",
				`${p.gist}`,
				"",
				...documents(p),
				...playground(p),
				"",
			);
		}
	}

	lines.push(
		"## What every package promises",
		"",
		...records(),
		"",
		"## The rules this repository holds itself to",
		"",
		"Written for whoever changes the framework, and readable by anyone deciding",
		"whether its opinions match theirs.",
		"",
		...canon(),
		"",
		"## Optional",
		"",
		`- [CHANGELOG.md](${rawUrl("CHANGELOG.md")}): what spans the packages, per release`,
		`- [perf/](${rawUrl("perf")}): the hot paths' recorded ratios, in yardsticks`,
		"",
	);

	return `${lines.join("\n")}`;
};

/** Writes the index. Called by the scaffolder, like every other generated file. */
export const generateLlmsIndex = () => {
	writeFileSync(join(ROOT, "llms.txt"), renderLlmsIndex(), "utf8");
};

/** Everything the index links to, as repository-relative paths. */
export const linkedPaths = (text) =>
	[...text.matchAll(/\]\((https:\/\/raw\.githubusercontent\.com\/[^)]+)\)/g)].map(([, url]) =>
		url.replace(/^.*\/refs\/heads\/main\//, ""),
	);

/** The packages named in the index, by npm name. */
export const namedPackages = (text) =>
	PACKAGES.map(pkgName).filter((name) => new RegExp(`(^|\\s)${name}(\\s|$)`, "m").test(text));

// The exact-URL idiom, not `endsWith`: "check-llms.mjs".endsWith("llms.mjs") is
// true, so the loose guard made the GATE rewrite the file it checks — a check
// that repairs its subject can never fail.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	generateLlmsIndex();
	console.log(
		`llms.txt written: ${String(readFileSync(join(ROOT, "llms.txt"), "utf8").split("\n").length)} lines`,
	);
}
