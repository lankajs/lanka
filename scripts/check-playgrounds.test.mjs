/**
 * Pins `check-playgrounds.mjs`: what counts as the applications drifting apart.
 *
 * Two subjects, and the first is the one that made this file necessary. The
 * gate's own scene-list parser reported success over four applications it had
 * never read: the annotation is `readonly string[]`, so the first bracket after
 * a list's name belongs to the TYPE, every list came back empty, and every
 * contract was satisfied vacuously. That is the way a check lies, and the only
 * defence is a spec that makes it FAIL on purpose.
 *
 * The second subject is the title extractor. A gate that under-matched would
 * report missing scenes that are there, and somebody would then weaken the
 * list rather than the regex.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkPlaygrounds, scenesIn } from "./check-playgrounds.mjs";
import { PLAYGROUNDS } from "../_playgrounds/hosts.mjs";

const ROOT = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");

/**
 * The real tree, copied to somewhere a test may break.
 *
 * Only what the gate reads: the scene lists, each application's suites, and
 * Astro's island directory. A fixture invented from nothing would prove the
 * fixture.
 */
const mirror = () => {
	const root = mkdtempSync(join(tmpdir(), "lanka-playgrounds-"));
	const copy = (relative) => {
		const to = join(root, relative);

		mkdirSync(dirname(to), { recursive: true });
		cpSync(join(ROOT, relative), to, { recursive: true });
	};

	copy("_playgrounds/_shared/src/atlasScenes.ts");
	copy("_playgrounds/astro/src/Modules/AtlasBoardModule");

	for (const playground of PLAYGROUNDS) {
		mkdirSync(join(root, playground.dir), { recursive: true });

		for (const suite of playground.suites) copy(join(playground.dir, suite));
	}

	return root;
};

describe("finding every scene a suite names", () => {
	it("reads a double-quoted title", () => {
		expect(scenesIn('it("renders what the ViewModel holds", () => {})')).toEqual([
			"renders what the ViewModel holds",
		]);
	});

	it("reads single quotes and backticks too, because a formatter may pick either", () => {
		expect(scenesIn("it('one', () => {});\nit(`two`, () => {});")).toEqual(["one", "two"]);
	});

	it("reads `it.each` and the rest of the family", () => {
		expect(scenesIn('it.skip("held back", () => {})')).toEqual(["held back"]);
	});

	it("does not mistake a word ending in `it` for the function", () => {
		// `await` and `submit` both end in the two letters, and a regex without a
		// word boundary reports their arguments as scene names — which reads as a
		// suite that claims things it never says.
		expect(scenesIn('submit("not a scene");\nawait("neither")')).toEqual([]);
	});

	it("keeps a title that contains an escaped quote", () => {
		expect(scenesIn('it("says \\"no\\" out loud", () => {})')).toEqual([
			'says \\"no\\" out loud',
		]);
	});
});

describe("holding the applications to their contract", () => {
	it("says nothing about the repository as it stands", () => {
		// If this ever goes red on an untouched checkout, the gate and the
		// applications disagree and one of them is wrong — say which.
		expect(checkPlaygrounds(ROOT)).toEqual([]);
	});

	it("names the application, the contract and the scene when one goes missing", () => {
		const root = mirror();
		const suite = join(root, "_playgrounds/svelte/spa/src/atlas-svelte.test.ts");
		const before = readFileSync(suite, "utf8");

		writeFileSync(
			suite,
			before.replace('it("filters as somebody types"', 'it("does something with the box"'),
			"utf8",
		);

		const problems = checkPlaygrounds(root);

		expect(problems).toHaveLength(1);
		expect(problems[0]).toContain("_playgrounds/svelte/spa");
		expect(problems[0]).toContain("SPA");
		expect(problems[0]).toContain("filters as somebody types");

		rmSync(root, { recursive: true, force: true });
	});

	it("notices a HOST that stopped saying it refuses a caller's identity", () => {
		// The scene most likely to be dropped, because the code still compiles
		// without it and the page still renders: a build that baked one user's
		// session into a shared page would look correct until two people loaded it.
		const root = mirror();
		const suite = join(root, "_playgrounds/vue/nuxt/src/Core/Server/readAtlasMissions.test.ts");

		writeFileSync(
			suite,
			readFileSync(suite, "utf8").replace(
				'it("REFUSES a caller\'s identity, which is the only difference from the request call"',
				'it("is different somehow"',
			),
			"utf8",
		);

		const problems = checkPlaygrounds(root);

		expect(problems).toHaveLength(1);
		expect(problems[0]).toContain("_playgrounds/vue/nuxt");
		expect(problems[0]).toContain("REFUSES a caller's identity");

		rmSync(root, { recursive: true, force: true });
	});

	it("notices an Astro island that disappeared", () => {
		// The ratchet on the shelf. A binding whose island goes missing is a
		// binding that stopped being proved to coexist with the other three, and
		// nothing else in the chain can see it.
		const root = mirror();

		rmSync(
			join(root, "_playgrounds/astro/src/Modules/AtlasBoardModule/AtlasBoardIslandSolid.tsx"),
		);

		const problems = checkPlaygrounds(root);

		expect(
			problems.some((one) => one.includes("[missing-island]") && one.includes("solid")),
		).toBe(true);

		rmSync(root, { recursive: true, force: true });
	});

	it("refuses a scene list it could not read, rather than passing everything", () => {
		// The defect this file exists for. An empty list satisfies every contract,
		// so the parser throws instead of returning one — and the gate stops rather
		// than printing success over applications it never opened.
		const root = mirror();
		const lists = join(root, "_playgrounds/_shared/src/atlasScenes.ts");

		writeFileSync(
			lists,
			readFileSync(lists, "utf8").replace(
				/export const ATLAS_SPA_SCENES: readonly string\[\] = \[[\s\S]*?\];/,
				"export const ATLAS_SPA_SCENES: readonly string[] = [];",
			),
			"utf8",
		);

		expect(() => checkPlaygrounds(root)).toThrow(/ATLAS_SPA_SCENES parsed as empty/);

		rmSync(root, { recursive: true, force: true });
	});
});
