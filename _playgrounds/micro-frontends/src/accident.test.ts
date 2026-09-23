import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { resetActiveLanka } from "lanka/bootstrap";
import { FROM_THE_SHELL, loadBundle, region, startShell } from "./_Testing/pageUnderTest";
import type { ILankaInstance } from "lanka/bootstrap";
import type { IMissionsBundle } from "./_Testing/pageUnderTest";
import type { TMicroFrontendBundler } from "./Core/Build/IMicroFrontendBuild";
import type { TMissionsMount } from "./Core/Mount/TMissionsMount";

/**
 * A module that bundled its own lanka BY ACCIDENT, from any of the bundlers.
 *
 * The build inlined lanka, and the module never starts it because the shell
 * already did — which is exactly what a real module in that position does.
 * Core makes it loud twice: the copy warns as it loads onto a page where
 * another copy runs in development, and the first thing the module asks its
 * own copy for — an instance to resolve its ViewModel in — names the cause.
 *
 * The same claim, per bundler: a check that held for Rollup's output and not
 * for webpack's or Rspack's would be a check about Rollup.
 */

/**
 * One accident per bundler. `load` is a literal `loadBundle` call rather than a
 * name assembled from fields, so `microFrontendPipelines.test.ts` can see which
 * bundle each row loads.
 */
interface IAccident {
	readonly bundler: TMicroFrontendBundler;
	readonly framework: string;
	readonly load: () => Promise<IMissionsBundle>;
	readonly mountOf: (bundle: IMissionsBundle) => TMissionsMount | undefined;
}

const ACCIDENTS: readonly IAccident[] = [
	{
		bundler: "vite",
		load: () => loadBundle("vite", "own-lanka", "missions-vue"),
		framework: "Vue",
		mountOf: (bundle) => bundle.mountMissionsVue,
	},
	{
		bundler: "webpack",
		load: () => loadBundle("webpack", "own-lanka", "missions-svelte"),
		framework: "Svelte",
		mountOf: (bundle) => bundle.mountMissionsSvelte,
	},
	{
		bundler: "rspack",
		load: () => loadBundle("rspack", "own-lanka", "missions-react"),
		framework: "React",
		mountOf: (bundle) => bundle.mountMissionsReact,
	},
];

let shell: ILankaInstance | null = null;

afterEach(() => {
	document.body.innerHTML = "";
	shell?.dispose();
	shell = null;
	vi.restoreAllMocks();
});

afterAll(() => {
	resetActiveLanka();
});

describe("a module that bundled its own lanka by accident", () => {
	it.each(ACCIDENTS)(
		"is warned about as it loads, and names the cause at mount — $framework from $bundler",
		async ({ load, mountOf }) => {
			shell = await startShell();
			const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

			const mount = mountOf(await load());

			expect(warn).toHaveBeenCalledWith(expect.stringContaining("two copies of lanka"));
			expect(() =>
				mount!(region(), { missions: FROM_THE_SHELL, scope: shell!.createScope() }),
			).toThrowError(/another copy of lanka/);
		},
	);
});
