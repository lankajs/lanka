import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { describe, expect, it, vi } from "vitest";
import { atlasApiBaseUrl } from "./Core/Server/atlasApiBaseUrl";
import { watchAtlasMissions } from "./Modules/AtlasWatchModule/watchAtlasMissions";
import type { AtlasMissionGateway, IAtlasMission } from "@lanka-playgrounds/_shared";
import type { IAtlasMissionChange } from "./Modules/AtlasWatchModule/watchAtlasMissions";

/**
 * The consumer with no screen.
 *
 * What only this package can show, and the reason the port exists at all: a
 * ViewModel read by something that will never render it. There is no jsdom under
 * these tests, so a line that needed a document would fail rather than quietly
 * find one.
 */
const mission = (id: string, over: Partial<IAtlasMission> = {}): IAtlasMission => ({
	id,
	code: `AT-10${id.replace(/\D/g, "")}`,
	title: `Mission ${id}`,
	status: "queued",
	priority: 3,
	crewId: null,
	updatedAt: "2026-09-15T00:00:00.000Z",
	...over,
});

const gateway = (): AtlasMissionGateway =>
	({
		list: vi.fn(() => Promise.resolve([mission("m-1")])),
		complete: vi.fn((id: string) => Promise.resolve(mission(id, { status: "done" }))),
		remove: vi.fn((id: string) => Promise.resolve({ id })),
	}) as unknown as AtlasMissionGateway;

const watched = () => {
	const missionsVM = createAtlasMissionsVM(gateway());
	const changes: IAtlasMissionChange[] = [];
	const stop = watchAtlasMissions({ missionsVM, onChange: (change) => changes.push(change) });

	return { missionsVM, changes, stop };
};

describe("watching a ViewModel with nothing rendering it", () => {
	it("reports what arrived", () => {
		const { missionsVM, changes, stop } = watched();

		missionsVM.setState({ missions: [mission("m-1"), mission("m-2")] });

		expect(changes).toEqual([{ count: 2, arrived: ["AT-101", "AT-102"], left: [] }]);
		stop();
	});

	it("reports what left", () => {
		const { missionsVM, changes, stop } = watched();
		missionsVM.setState({ missions: [mission("m-1"), mission("m-2")] });

		missionsVM.setState({ missions: [mission("m-2")] });

		expect(changes.at(-1)).toEqual({ count: 1, arrived: [], left: ["AT-101"] });
		stop();
	});

	it("reports both at once, because a refresh is usually both", () => {
		const { missionsVM, changes, stop } = watched();
		missionsVM.setState({ missions: [mission("m-1")] });

		missionsVM.setState({ missions: [mission("m-2")] });

		expect(changes.at(-1)).toEqual({ count: 1, arrived: ["AT-102"], left: ["AT-101"] });
		stop();
	});

	it("says nothing when the set of missions did not move", () => {
		// The service's whole reason for comparing: a search, a page or a spinner
		// is not news to a queue, and a watcher that forwarded every notification
		// would turn one keystroke into one message.
		const { missionsVM, changes, stop } = watched();
		missionsVM.setState({ missions: [mission("m-1")] });
		const afterLoad = changes.length;

		missionsVM.getState().applySearch("anything");
		missionsVM.getState().goToPage(2);

		expect(changes).toHaveLength(afterLoad);
		stop();
	});

	it("stops when told to, and the ViewModel goes on living", () => {
		const { missionsVM, changes, stop } = watched();

		stop();
		missionsVM.setState({ missions: [mission("m-9")] });

		expect(changes).toEqual([]);
		expect(missionsVM.getState().missions).toHaveLength(1);
	});

	it("is the only thing between the store and the consumer", () => {
		// Fourteen lines and no framework. That is the measurement this playground
		// exists to make: what the five bindings add on top of `subscribe` is a
		// framework's idea of WHEN to re-read, and a consumer that reads everything
		// needs none of it.
		const source = readFileSync("src/Modules/AtlasWatchModule/watchAtlasMissions.ts", "utf8");

		expect(source).toContain("missionsVM.subscribe");
		expect(source).not.toContain("useLankaVM");
	});
});

describe("where the API is", () => {
	it("falls back to the development address", () => {
		const before = process.env.ATLAS_API;
		delete process.env.ATLAS_API;

		expect(atlasApiBaseUrl()).toBe("http://127.0.0.1:4380/api");

		if (before !== undefined) process.env.ATLAS_API = before;
	});

	it("reads the environment when a deployment set one", () => {
		const before = process.env.ATLAS_API;
		process.env.ATLAS_API = "https://atlas.example/api";

		expect(atlasApiBaseUrl()).toBe("https://atlas.example/api");

		if (before === undefined) delete process.env.ATLAS_API;
		else process.env.ATLAS_API = before;
	});
});

describe("what is NOT in this application", () => {
	/**
	 * The scene `_playgrounds/vanilla` makes about frameworks, made here about the
	 * DOM.
	 *
	 * Vanilla proves lanka runs with no framework; this proves it runs with no
	 * document — which is the half a server, a worker and a CLI care about, and
	 * the half no browser playground can fail on.
	 */
	const FRAMEWORKS = ["react", "react-dom", "vue", "svelte", "solid-js", "@angular/core"];

	const sourcesOf = (dir: string): string[] =>
		readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
			const path = join(dir, entry.name);

			return entry.isDirectory() ? sourcesOf(path) : path.endsWith(".ts") ? [path] : [];
		});

	it("touches no UI framework and no DOM global, in any source file", () => {
		const offenders = sourcesOf("src")
			.filter((path) => !path.endsWith(".test.ts"))
			.flatMap((path) => {
				// Comments stripped first: this is about what the CODE reaches for, and
				// a docblock saying none of it ever needed a document is not a use of
				// `document`.
				const code = readFileSync(path, "utf8")
					.replace(/\/\*[\s\S]*?\*\//g, "")
					.replace(/\/\/.*$/gm, "");
				const imported = FRAMEWORKS.filter((name) => code.includes(`from "${name}`));
				const dom = /\b(document|window|localStorage)\s*\./.test(code)
					? ["a DOM global"]
					: [];

				return [...imported, ...dom].map((what) => `${path} uses ${what}`);
			});

		expect(offenders).toEqual([]);
	});

	it("installs no UI framework and no DOM shim, in its manifest", () => {
		const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
		};
		const declared = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });

		expect(declared.filter((name) => FRAMEWORKS.some((ui) => name.startsWith(ui)))).toEqual([]);
		// No jsdom either, which the vanilla application DOES install — the
		// difference between "no framework" and "no screen" in one assertion.
		expect(declared.filter((name) => name.includes("jsdom"))).toEqual([]);
	});

	it("runs its suite in node, which is what makes the two above mean anything", () => {
		const config = readFileSync("vitest.config.ts", "utf8");

		expect(config).toContain('environment: "node"');
	});
});
