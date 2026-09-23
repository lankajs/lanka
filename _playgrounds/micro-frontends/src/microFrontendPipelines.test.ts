import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MICRO_FRONTEND_PIPELINES } from "./Core/Build/microFrontendPipelines";

/**
 * The matrix, held to what it claims.
 *
 * A bundle that is built and never loaded is a variant that looks covered and
 * is not — the build succeeds, the suites stay green, and nobody notices that
 * the one scene that would have caught a regression in webpack's Svelte output
 * was never written. So every bundle a pipeline builds must be loaded by some
 * scene, and every framework must go through every bundler.
 *
 * What this proves is LOADED, not asserted: it reads the suites as text. What a
 * scene asserts about each bundle it loads is the scene's job, and every scene
 * that loads a bundle to render it checks what that bundle shows.
 */

/** Every `loadBundle("<bundler>", "<sharing>", "<name>")` in the scenes, as `bundler/sharing/name`. */
const loadedByScenes = (): Set<string> => {
	// From the working directory, which is this application's root: under jsdom
	// `import.meta.url` is not a file URL.
	const here = join(process.cwd(), "src");
	// Not this file: its own comments name the call it looks for.
	const suites = readdirSync(here).filter(
		(file) => file.endsWith(".test.ts") && file !== "microFrontendPipelines.test.ts",
	);
	const loads = suites.flatMap((file) =>
		[
			...readFileSync(join(here, file), "utf8").matchAll(
				/loadBundle\(\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\s*\)/g,
			),
		].map(([, bundler, sharing, name]) => `${bundler}/${sharing}/${name}`),
	);
	return new Set(loads);
};

const built = MICRO_FRONTEND_PIPELINES.flatMap(({ bundler, sharing, modules }) =>
	modules.map(({ name }) => `${bundler}/${sharing}/${name}`),
);

/** The framework a bundle renders, read from its entry's folder. */
const frameworkOf = (entry: string): string => /Missions(\w+?)Module/.exec(entry)?.[1] ?? entry;

describe("the micro-frontend matrix", () => {
	it("loads every bundle it builds in some scene", () => {
		const loaded = loadedByScenes();

		expect(built.filter((bundle) => !loaded.has(bundle))).toEqual([]);
	});

	it("loads nothing it does not build", () => {
		// The other direction: a scene naming a bundle no pipeline produces fails
		// at import, but only once it runs — this says so before it does.
		expect([...loadedByScenes()].filter((bundle) => !built.includes(bundle))).toEqual([]);
	});

	it("puts every framework through every bundler", () => {
		const bundlersOf = new Map<string, Set<string>>();

		for (const { bundler, modules } of MICRO_FRONTEND_PIPELINES) {
			for (const { entry } of modules) {
				const framework = frameworkOf(entry);
				bundlersOf.set(framework, (bundlersOf.get(framework) ?? new Set()).add(bundler));
			}
		}

		expect(
			Object.fromEntries(
				[...bundlersOf].map(([framework, set]) => [framework, [...set].sort()]),
			),
		).toEqual({
			React: ["rspack", "vite", "webpack"],
			Vue: ["rspack", "vite", "webpack"],
			Svelte: ["rspack", "vite", "webpack"],
			Angular: ["rspack", "vite", "webpack"],
		});
	});

	it("has each bundler produce a module that shares lanka and one that carries its own", () => {
		const pairs = new Set(
			MICRO_FRONTEND_PIPELINES.map(({ bundler, sharing }) => `${bundler}/${sharing}`),
		);

		expect([...pairs].sort()).toEqual([
			"rspack/one-lanka",
			"rspack/own-lanka",
			"vite/one-lanka",
			"vite/own-lanka",
			"webpack/one-lanka",
			"webpack/own-lanka",
		]);
	});
});
