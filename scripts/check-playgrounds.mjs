/**
 * Checks that the applications under `_playgrounds/` keep saying the same things.
 *
 * Six applications written by hand diverge the way six hand-written validator
 * suites would — not on the day they are written, but on the day one of them
 * gets a scene and five do not. Nothing else in the chain can see it: every
 * suite is green, every typecheck passes, and the claim that five frameworks
 * behave identically quietly stops being checked by anything.
 *
 * Seven questions:
 *
 * 1. does every application named in `_playgrounds/hosts.mjs` exist, with the
 *    suites it says it has;
 * 2. does each one contain an `it(...)` for every scene its CONTRACT names;
 * 3. does every application NAME every lanka package it installs;
 * 4. is every package reachable from every ECOSYSTEM;
 * 5. does every binding on the shelf have an ecosystem folder — a binding
 *    nobody built an application on is a binding nothing proved;
 * 6. does Astro carry one island per binding that has an integration, with
 *    every other binding accounted for by a written exclusion;
 * 7. is every barrel LAYOUT the tooling supports still carried by an
 *    application — each directory name, and the two of them at once.
 *
 * The fourth is what makes five applications worth their cost. They exist so a
 * complex change can be tried against five frameworks at once, and a package
 * only some of them reach turns "it works" into "it works under React" without
 * anybody deciding that. A FAMILY answers a weaker question — reached by at
 * least one ecosystem — because an application installs one member per family,
 * and requiring the Vue application to reach React's binding would require the
 * thing the shelf exists to make unnecessary.
 *
 * The sixth is the ratchet on the shelf. Astro is the only host that mounts
 * four frameworks in one page, one process and one bundle, so a sixth binding
 * is an island there or a line in `ASTRO_ISLAND_EXCLUSIONS` — and either way it
 * is a decision rather than a forgotten island.
 *
 * The seventh is the same ratchet over the barrel directories. `.lanka` and
 * `.lanka_di` are both legal, a project may use BOTH at once, and the
 * applications here are the only place any of those arrangements is resolved by
 * a real program rather than by a unit test with a temporary directory. Almost
 * all of them are on `.lanka` because it is what a new project gets; one stays
 * on `.lanka_di`, and one keeps barrels in both. This check is what stops either
 * being tidied into line — the day it happens, a supported layout goes untested
 * everywhere a resolver can see it, and nothing else would say so.
 *
 * ## Titles, matched exactly
 *
 * A gate that matched "something about paging" would pass a suite that renamed
 * a scene into meaninglessness. `check-family` holds the validator shelf
 * together the same way, and for the same reason: the contract has to be
 * readable in both directions.
 *
 * Run: node scripts/check-playgrounds.mjs
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PLAYGROUNDS } from "../_playgrounds/hosts.mjs";
import { PACKAGES, pkgName } from "./registry.mjs";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

/**
 * The scene lists, read as TEXT rather than imported.
 *
 * `atlasScenes.ts` is TypeScript in a workspace that is consumed from source,
 * and this script is plain node. Parsing the three arrays out of it is five
 * lines; making the script able to import TypeScript is a build step in the
 * middle of a gate.
 */
const sceneListsFrom = (source) => {
	const listOf = (name) => {
		const at = source.indexOf(`export const ${name}`);
		if (at < 0) throw new Error(`atlasScenes.ts has no ${name}`);

		/*
		 * `= [` and not `[`, and the difference is why this gate reported success
		 * on its first run over four applications it had not read: the annotation
		 * is `readonly string[]`, so the first bracket after the name belongs to
		 * the TYPE. Every list came back empty, every contract was satisfied
		 * vacuously, and the output said the applications still agreed.
		 *
		 * The emptiness check below is the second half of the same lesson. A
		 * parser that silently finds nothing is worse than one that throws.
		 */
		const open = source.indexOf("= [", at) + 2;
		const close = source.indexOf("]", open);
		const found = [...source.slice(open, close).matchAll(/"([^"]+)"/g)].map((one) => one[1]);

		if (found.length === 0) throw new Error(`atlasScenes.ts: ${name} parsed as empty`);

		return found;
	};

	const exclusions = () => {
		const at = source.indexOf("export const ASTRO_ISLAND_EXCLUSIONS");
		if (at < 0) throw new Error("atlasScenes.ts has no ASTRO_ISLAND_EXCLUSIONS");

		const open = source.indexOf("{", at);
		const close = source.indexOf("};", open);

		return [...source.slice(open, close).matchAll(/^\t([A-Za-z]+):/gm)].map((one) => one[1]);
	};

	/** The body of one `export const NAME: … = { … };`, without its braces. */
	const bodyOf = (name) => {
		const at = source.indexOf(`export const ${name}`);
		if (at < 0) throw new Error(`atlasScenes.ts has no ${name}`);

		const open = source.indexOf("= {", at) + 2;
		const close = source.indexOf("\n};", open);

		return source.slice(open, close);
	};

	/**
	 * A map of package to ecosystem to reason, as two levels of keys.
	 *
	 * Only the KEYS are read: whether a reason exists is the question, and its
	 * wording is for the person who meets it. A reason long enough to be one is
	 * asserted on the TypeScript side, where it is a value rather than a match.
	 */
	const nestedKeys = (name) => {
		const found = {};

		for (const [, key, inner] of bodyOf(name).matchAll(
			/^\t"?([@\w/.-]+)"?: \{([\s\S]*?)^\t\},$/gm,
		)) {
			found[key] = Object.fromEntries(
				[...inner.matchAll(/^\t\t(\w+):/gm)].map((one) => [one[1], true]),
			);
		}

		return found;
	};

	/** One level of keys, for a map of package to reason. */
	const flatKeys = (name) =>
		Object.fromEntries(
			[...bodyOf(name).matchAll(/^\t"([@\w/.-]+)":/gm)].map((one) => [one[1], true]),
		);

	return {
		SPA: listOf("ATLAS_SPA_SCENES"),
		HOST: listOf("ATLAS_HOST_SCENES"),
		ISLANDS: listOf("ATLAS_ISLAND_SCENES"),
		astroBindings: listOf("ASTRO_ISLAND_BINDINGS"),
		astroExclusions: exclusions(),
		ecosystems: listOf("ATLAS_ECOSYSTEMS"),
		reachExclusions: nestedKeys("ATLAS_REACH_EXCLUSIONS"),
		unimportable: flatKeys("ATLAS_UNIMPORTABLE"),
	};
};

/** Every `it("...")` title in a file, however the quotes are spelled. */
export const scenesIn = (source) =>
	[...source.matchAll(/\bit(?:\.\w+)?\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g)].map((one) => one[2]);

/** What a playground's suites claim, as one set. */
const claimsOf = (playground, root) => {
	const found = new Set();
	const missingFiles = [];

	for (const suite of playground.suites) {
		const path = join(root, playground.dir, suite);

		if (!existsSync(path)) {
			missingFiles.push(suite);
			continue;
		}

		for (const title of scenesIn(readFileSync(path, "utf8"))) found.add(title);
	}

	return { found, missingFiles };
};

/**
 * The barrel directories an application may keep its wiring in.
 *
 * BOTH legal names, not the one most applications here happen to use. The walk
 * below skips dot-directories, so a playground on the other name would have its
 * barrels read as "not source" — and every package named ONLY from a barrel
 * would then report as an unused dependency, a failure about the directory's
 * spelling rather than about anything this gate checks.
 *
 * Copied, not imported: `lankaDiContract.dirnames` in `tools/di` owns the list,
 * and that file is TypeScript this plain-node gate cannot read. A THIRD name
 * admitted there and not added here would go unchecked rather than misreported
 * — which is why the check below names the shortfall by directory rather than
 * counting.
 */
const BARREL_DIRS = [".lanka", ".lanka_di"];

/** Every file an application could name a package in. */
const sourcesOf = (dir, found = []) => {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (["node_modules", "dist", "coverage", ".output"].includes(entry.name)) continue;
		if (entry.name.startsWith(".") && !BARREL_DIRS.includes(entry.name)) continue;

		const path = join(dir, entry.name);

		if (entry.isDirectory()) sourcesOf(path, found);
		else if (/\.(ts|tsx|vue|svelte|astro|mjs|js|json)$/.test(entry.name)) found.push(path);
	}

	return found;
};

/**
 * A lanka package an application INSTALLS and never names.
 *
 * A dependency is a claim that this application exercises that package, and a
 * claim nothing backs is worse than no claim: it is the shape of coverage
 * without the substance. Two were found the day this rule was written —
 * `@lankajs/nanostores-query` in the React application and `@lankajs/unstorage`
 * in the Next one — and between them they meant the nanostores member of the
 * query family and the only storage adapter that runs on a SERVER were proved
 * by nothing at all.
 *
 * Reported per application rather than repository-wide, because the question is
 * what each one demonstrates. A package used somewhere is not a package used
 * here.
 */
const unusedDependencies = (playground, root, unimportable) => {
	const manifestPath = join(root, playground.dir, "package.json");
	if (!existsSync(manifestPath)) return [];

	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	const declared = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).filter(
		(one) => (one === "lanka" || one.startsWith("@lankajs/")) && !(one in unimportable),
	);

	if (declared.length === 0) return [];

	const text = sourcesOf(join(root, playground.dir))
		.filter((path) => !path.endsWith("package.json"))
		.map((path) => readFileSync(path, "utf8"))
		.join("\n");

	return declared.filter((one) => !text.includes(one));
};

/**
 * Everything one ecosystem's applications and shared code could name a package in.
 *
 * An ecosystem is its own folder plus the framework-free application every one
 * of them is built on. React's `_shared` belongs to React; `_playgrounds/_shared`
 * belongs to all five, and a package reached only from there is reached by
 * everybody — which is the right answer, because that is code every ecosystem
 * runs.
 */
const ecosystemDirs = (ecosystem, root) => [
	join(root, "_playgrounds", ecosystem),
	join(root, "_playgrounds/_shared"),
];

/**
 * A package no application in one ecosystem can reach.
 *
 * The point of five applications over five frameworks is that a complex change
 * can be tried against all of them. A package exercised only under React means
 * "it works" only ever means "it works under React" — and the day somebody
 * needs to know whether `@lankajs/optimistic` behaves the same under Solid,
 * finding out costs a new application rather than a test run.
 *
 * Every exception is a line in `ATLAS_REACH_EXCLUSIONS` with a reason. "Not yet"
 * is legitimate as long as it says what would change it; "nobody got round to
 * it" written down beats the same fact undiscovered.
 */
export const unreachedPackages = (root, lists) => {
	const problems = [];
	const considered = PACKAGES.filter(
		(one) => pkgName(one) !== "lanka" && !(pkgName(one) in lists.unimportable),
	);

	const reachedBy = new Map();

	for (const ecosystem of lists.ecosystems) {
		const text = ecosystemDirs(ecosystem, root)
			.filter((dir) => existsSync(dir))
			.flatMap((dir) => sourcesOf(dir))
			.filter((path) => !path.endsWith("package.json"))
			.map((path) => readFileSync(path, "utf8"))
			.join("\n");

		reachedBy.set(
			ecosystem,
			new Set(considered.map((one) => pkgName(one)).filter((name) => text.includes(name))),
		);
	}

	for (const entry of considered) {
		const name = pkgName(entry);

		/*
		 * A family member answers a WEAKER question, and the weaker one is the
		 * true one: an application installs one member per family, so requiring
		 * the Vue application to reach React's binding would require the thing the
		 * shelf exists to make unnecessary. What matters is that no member is
		 * proved by nobody — `check-family` then proves they are interchangeable.
		 */
		if (entry.family) {
			if ([...reachedBy.values()].some((reached) => reached.has(name))) continue;

			problems.push(
				`[unreached-package] no ecosystem names ${name}, a member of the ${entry.family} family. Its siblings are proved by an application each; a member proved by none is a member whose interchangeability is a claim about a conformance suite and nothing else.`,
			);

			continue;
		}

		for (const ecosystem of lists.ecosystems) {
			if (reachedBy.get(ecosystem)?.has(name)) continue;
			if (lists.reachExclusions[name]?.[ecosystem]) continue;

			problems.push(
				`[unreached-package] nothing in the ${ecosystem} ecosystem names ${name}. Five applications exist so a change can be tried against five frameworks; a package only some of them reach is a package proved under some of them. Exercise it, or write the reason in ATLAS_REACH_EXCLUSIONS.`,
			);
		}
	}

	return problems;
};

/** Which bindings the shelf holds right now. */
const shelfFrameworks = () =>
	PACKAGES.filter((one) => one.family === "bindings" && one.framework).map(
		(one) => one.framework,
	);

/** Which island files Astro has, by the binding each one is written in. */
const astroIslands = (root) => {
	const dir = join(root, "_playgrounds/astro/src/Modules/AtlasBoardModule");
	if (!existsSync(dir)) return [];

	const files = readdirSync(dir).filter((one) => !one.includes(".test."));
	const byBinding = {
		react: /^AtlasBoardIsland\.tsx$/,
		vue: /Vue\.vue$/,
		svelte: /Svelte\.svelte$/,
		solid: /Solid\.tsx$/,
	};

	return Object.entries(byBinding)
		.filter(([, pattern]) => files.some((one) => pattern.test(one)))
		.map(([binding]) => binding);
};

/**
 * Which barrel directories each application actually has on disk.
 *
 * On disk and not from `tsconfig.json`, because the directory is what a bundler
 * resolves; a `paths` entry naming one that is not there is the failure this
 * would otherwise read as a pass. Applications with no barrels at all — the
 * server, the shared halves — simply report none, which is not a problem: an
 * application that publishes nothing to the framework has nothing to name.
 */
const barrelDirsOf = (root) => {
	const byPlayground = new Map();

	for (const { dir } of PLAYGROUNDS) {
		if (byPlayground.has(dir)) continue;
		byPlayground.set(
			dir,
			BARREL_DIRS.filter((name) => existsSync(join(root, dir, name))),
		);
	}

	return byPlayground;
};

/**
 * Every layout the tooling supports, carried by at least one application.
 *
 * Three of them, and none is a rule about what an application SHOULD do. They
 * are the arrangements `@lankajs/tool-di` resolves, and these applications are
 * the only place any of them meets a real `tsconfig` and a real module resolver
 * rather than a unit test in a temporary directory:
 *
 * - `.lanka` alone, which is what a new project gets;
 * - `.lanka_di` alone, which is what the first consumers got and still works;
 * - BOTH at once, which a team may choose by abstraction or by shard.
 *
 * The third is the one this check exists for. "Just put them in one directory
 * for consistency" is a change that looks like tidying, passes review, and takes
 * a supported layout out of every build in the repository at once.
 */
export const barrelNameCoverage = (root) => {
	const problems = [];
	const dirs = barrelDirsOf(root);
	const carried = new Set([...dirs.values()].flat());

	for (const name of BARREL_DIRS) {
		if (!carried.has(name)) {
			problems.push(
				`[unproven-barrel-name] ${name}/ is a legal barrel directory and no application here uses it. Both names are resolved by the same tooling, and these applications are the only place either is resolved by a real build. Put one application back on ${name}/, or retire the name in tools/di.`,
			);
		}
	}

	if (![...dirs.values()].some((found) => found.length === BARREL_DIRS.length)) {
		problems.push(
			`[unproven-barrel-layout] no application keeps barrels in ${BARREL_DIRS.join(" and ")} at once. Using both is supported — by abstraction, or by sharding one barrel across the two — and a supported layout nothing is built on is a layout nothing proves. Put one application back on both, or take the support out of tools/di.`,
		);
	}

	return problems;
};

export const checkPlaygrounds = (root = ROOT) => {
	const problems = [];
	const scenes = sceneListsFrom(
		readFileSync(join(root, "_playgrounds/_shared/src/atlasScenes.ts"), "utf8"),
	);

	const seenManifests = new Set();

	for (const playground of PLAYGROUNDS) {
		if (!existsSync(join(root, playground.dir))) {
			problems.push(`[missing] ${playground.dir} is named in hosts.mjs and does not exist.`);
			continue;
		}

		// One application may answer to two contracts — Angular is both an SPA and a
		// HOST in one directory — and its manifest must be read once, not twice.
		for (const dead of seenManifests.has(playground.dir)
			? []
			: unusedDependencies(playground, root, scenes.unimportable)) {
			problems.push(
				`[unused-dependency] ${playground.dir} installs ${dead} and never names it. A dependency is a claim that this application exercises that package; a claim nothing backs is coverage without the substance. Use it, or take it out of the manifest.`,
			);
		}

		seenManifests.add(playground.dir);

		if (playground.contract === "NONE") continue;

		const { found, missingFiles } = claimsOf(playground, root);

		for (const file of missingFiles) {
			problems.push(
				`[missing-suite] ${playground.dir}/${file} is named in hosts.mjs and does not exist.`,
			);
		}

		for (const scene of scenes[playground.contract]) {
			if (!found.has(scene)) {
				problems.push(
					`[missing-scene] ${playground.dir} (${playground.contract}) never says "${scene}". Every application on this contract claims it; one that stopped is one nothing holds to the others.`,
				);
			}
		}
	}

	const built = new Set(PLAYGROUNDS.map((one) => one.ecosystem).filter(Boolean));

	for (const framework of shelfFrameworks()) {
		if (!built.has(framework)) {
			problems.push(
				`[unproven-binding] the shelf holds a ${framework} binding and no application is built on it. A binding nobody built an application on is a binding nothing proved under a real build.`,
			);
		}
	}

	problems.push(...unreachedPackages(root, scenes));
	problems.push(...barrelNameCoverage(root));

	const islands = astroIslands(root);

	for (const binding of scenes.astroBindings) {
		if (!islands.includes(binding)) {
			problems.push(
				`[missing-island] ASTRO_ISLAND_BINDINGS names ${binding} and _playgrounds/astro has no island in it.`,
			);
		}
	}

	for (const framework of shelfFrameworks()) {
		if (
			!scenes.astroBindings.includes(framework) &&
			!scenes.astroExclusions.includes(framework)
		) {
			problems.push(
				`[unaccounted-binding] ${framework} is on the shelf and appears in neither ASTRO_ISLAND_BINDINGS nor ASTRO_ISLAND_EXCLUSIONS. Add the island, or write down why there is none.`,
			);
		}
	}

	return problems;
};

const isMain = process.argv[1]?.endsWith("check-playgrounds.mjs");

if (isMain) {
	const problems = checkPlaygrounds();

	if (problems.length > 0) {
		console.error(`\nTHE APPLICATIONS HAVE DRIFTED (${problems.length})\n`);
		for (const problem of problems) console.error(`  ${problem}`);
		console.error(
			"\nCanon: _playgrounds/_shared/src/atlasScenes.ts, and _plans/14-framework-independence.md\n",
		);
		process.exit(1);
	}

	const held = PLAYGROUNDS.filter((one) => one.contract !== "NONE").length;

	console.log(
		`the applications still say the same things: ${held} on a contract, ${astroIslands(ROOT).length} islands on one Astro page`,
	);
}
