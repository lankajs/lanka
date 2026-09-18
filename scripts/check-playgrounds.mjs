/**
 * Checks that the applications under `_playgrounds/` keep saying the same things.
 *
 * Six applications written by hand diverge the way six hand-written validator
 * suites would — not on the day they are written, but on the day one of them
 * gets a scene and five do not. Nothing else in the chain can see it: every
 * suite is green, every typecheck passes, and the claim that five frameworks
 * behave identically quietly stops being checked by anything.
 *
 * Four questions:
 *
 * 1. does every application named in `_playgrounds/hosts.mjs` exist, with the
 *    suites it says it has;
 * 2. does each one contain an `it(...)` for every scene its CONTRACT names;
 * 3. does every binding on the shelf have an ecosystem folder — a binding
 *    nobody built an application on is a binding nothing proved;
 * 4. does Astro carry one island per binding that has an integration, with
 *    every other binding accounted for by a written exclusion.
 *
 * The fourth is the ratchet on the shelf. Astro is the only host that mounts
 * four frameworks in one page, one process and one bundle, so a sixth binding
 * is an island there or a line in `ASTRO_ISLAND_EXCLUSIONS` — and either way it
 * is a decision rather than a forgotten island.
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
import { PACKAGES } from "./registry.mjs";

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

	return {
		SPA: listOf("ATLAS_SPA_SCENES"),
		HOST: listOf("ATLAS_HOST_SCENES"),
		ISLANDS: listOf("ATLAS_ISLAND_SCENES"),
		astroBindings: listOf("ASTRO_ISLAND_BINDINGS"),
		astroExclusions: exclusions(),
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

export const checkPlaygrounds = (root = ROOT) => {
	const problems = [];
	const scenes = sceneListsFrom(
		readFileSync(join(root, "_playgrounds/_shared/src/atlasScenes.ts"), "utf8"),
	);

	for (const playground of PLAYGROUNDS) {
		if (!existsSync(join(root, playground.dir))) {
			problems.push(`[missing] ${playground.dir} is named in hosts.mjs and does not exist.`);
			continue;
		}

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
