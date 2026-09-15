import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { AtlasBoardVM, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { LankaError } from "lanka/errors";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { atlasBoardScreen } from "./Modules/AtlasBoardModule/AtlasBoardScreen";
import { atlasMissionsScreen } from "./Modules/AtlasMissionsModule/AtlasMissionsScreen";
import { bindAtlasVM } from "./Core/Render/bindAtlasVM";
import { renderAtlasList } from "./Core/Render/renderAtlasList";
import type {
	AtlasBoardGateway,
	AtlasMissionGateway,
	IAtlasMission,
} from "@lanka-playgrounds/_shared";

/**
 * Atlas with no framework under it at all.
 *
 * Every other application here proves that lanka works INSIDE somebody's
 * framework. This one proves the sentence the whole of `_plans/14` was written
 * for: that there does not have to be anything to be inside. The ViewModels the
 * browser, the server-rendered page, the island and the device all read are read
 * here through `getState` and `subscribe`, and painted with `replaceChildren`.
 *
 * The last block is the scene no other file in this repository can make: it reads
 * this package's own sources and manifest and asserts that no UI framework
 * appears in either.
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

const ROWS = [
	mission("m-1", { title: "Survey the north ridge" }),
	mission("m-2", { title: "Restock the depot" }),
];

const fakeMissionGateway = (over: Record<string, unknown> = {}): AtlasMissionGateway =>
	({
		list: vi.fn(() => Promise.resolve([...ROWS])),
		complete: vi.fn((id: string) => Promise.resolve(mission(id, { status: "done" }))),
		remove: vi.fn((id: string) => Promise.resolve({ id })),
		...over,
	}) as unknown as AtlasMissionGateway;

const fakeBoardGateway = (over: Record<string, unknown> = {}): AtlasBoardGateway =>
	({
		summary: vi.fn(() => Promise.resolve({ queued: 2, active: 1, done: 0 })),
		post: vi.fn(() => Promise.resolve({ text: "ack", at: "2026-09-15T00:00:00.000Z" })),
		...over,
	}) as unknown as AtlasBoardGateway;

let root: HTMLElement;

beforeEach(() => {
	root = document.createElement("main");
	document.body.append(root);
});

afterEach(() => {
	root.remove();
	vi.restoreAllMocks();
});

const textsOf = (testid: string): string[] =>
	[...root.querySelectorAll(`[data-testid="${testid}"] li`)].map(
		(item) => item.textContent ?? "",
	);

describe("the missions screen, with nothing rendering it", () => {
	it("paints what the ViewModel holds, through subscribe alone", async () => {
		const missionsVM = createAtlasMissionsVM(fakeMissionGateway());
		const stop = atlasMissionsScreen({ missionsVM, root });

		await missionsVM.getState().fetchMissions();

		expect(textsOf("missions")).toEqual(["Survey the north ridge", "Restock the depot"]);
		stop();
	});

	it("paints once BEFORE anything changes", () => {
		// The first paint is not a subscription callback — `subscribe` does not fire
		// on registration. A binding that forgot it shows an empty screen until the
		// first action, which is invisible in a suite that always acts.
		const missionsVM = createAtlasMissionsVM(fakeMissionGateway());
		const stop = atlasMissionsScreen({ missionsVM, root });

		expect(root.querySelector('[data-testid="missions-status"]')?.textContent).toBe("page 1");
		stop();
	});

	it("repaints when an action writes, with nothing telling it to", async () => {
		const missionsVM = createAtlasMissionsVM(fakeMissionGateway());
		const stop = atlasMissionsScreen({ missionsVM, root });
		await missionsVM.getState().fetchMissions();

		missionsVM.getState().applySearch("depot");

		expect(textsOf("missions")).toEqual(["Restock the depot"]);
		stop();
	});

	it("routes a typed search through the ViewModel and back to the DOM", async () => {
		const missionsVM = createAtlasMissionsVM(fakeMissionGateway());
		const stop = atlasMissionsScreen({ missionsVM, root });
		await missionsVM.getState().fetchMissions();

		const search = root.querySelector("input");
		search!.value = "ridge";
		search!.dispatchEvent(new Event("input"));

		// A whole round trip with no framework in it: an event listener called an
		// action, the store notified, and the subscriber repainted.
		expect(textsOf("missions")).toEqual(["Survey the north ridge"]);
		expect(missionsVM.getState().search).toBe("ridge");
		stop();
	});

	it("shows the failure the ViewModel named, not a raw throw", async () => {
		const missionsVM = createAtlasMissionsVM(
			fakeMissionGateway({
				list: vi.fn(() =>
					Promise.reject(new LankaError({ kind: "network", message: "no route" })),
				),
			}),
		);
		const stop = atlasMissionsScreen({ missionsVM, root });

		await missionsVM.getState().fetchMissions();

		expect(missionsVM.getState().error).not.toBeNull();
		expect(root.querySelector('[data-testid="missions-status"]')?.textContent).toBe(
			missionsVM.getState().error,
		);
		stop();
	});

	it("stops painting once the screen is taken down", async () => {
		const missionsVM = createAtlasMissionsVM(fakeMissionGateway());
		const stop = atlasMissionsScreen({ missionsVM, root });
		await missionsVM.getState().fetchMissions();

		stop();
		missionsVM.getState().applySearch("depot");

		// Still the pre-teardown paint. A subscription that outlived its screen
		// would be writing into a node nobody is looking at — the leak a framework
		// hides behind an effect's cleanup, and which here is one returned function.
		expect(textsOf("missions")).toEqual(["Survey the north ridge", "Restock the depot"]);
	});
});

describe("the board screen, over the same ViewModel every other application reads", () => {
	it("paints the summary a gateway answered with", async () => {
		const boardVM = new AtlasBoardVM(fakeBoardGateway()).build();
		const stop = atlasBoardScreen({ boardVM, root });

		await boardVM.getState().fetchSummary();

		expect(root.querySelector('[data-testid="board-summary"]')?.textContent).toBe("2 queued");
		stop();
	});

	it("paints a message that arrived from somewhere else entirely", () => {
		const boardVM = new AtlasBoardVM(fakeBoardGateway()).build();
		const stop = atlasBoardScreen({ boardVM, root });

		// `setState` and not an action, standing in for the scenario subscription a
		// live stream drives. The screen cannot tell the two apart, which is the
		// property that makes a ViewModel portable in the first place.
		boardVM.setState({ messages: [{ text: "ridge clear", at: "2026-09-15T00:00:00.000Z" }] });

		expect(textsOf("board-messages")).toEqual(["ridge clear"]);
		stop();
	});

	it("says so when there is no summary yet", () => {
		const boardVM = new AtlasBoardVM(fakeBoardGateway()).build();
		const stop = atlasBoardScreen({ boardVM, root });

		expect(root.querySelector('[data-testid="board-summary"]')?.textContent).toBe("no summary");
		stop();
	});
});

describe("bindAtlasVM — the whole of what a binding does", () => {
	it("paints once immediately, then once per change", () => {
		const missionsVM = createAtlasMissionsVM(fakeMissionGateway());
		const paints: number[] = [];

		const stop = bindAtlasVM(missionsVM, (state) => paints.push(state.page));
		missionsVM.getState().goToPage(2);

		expect(paints).toEqual([1, 2]);
		stop();
	});

	it("hands the NEXT state to the painter, never the previous one", () => {
		const missionsVM = createAtlasMissionsVM(fakeMissionGateway());
		const seen: string[] = [];
		const stop = bindAtlasVM(missionsVM, (state) => seen.push(state.search));

		missionsVM.getState().applySearch("depot");

		expect(seen.at(-1)).toBe("depot");
		stop();
	});

	it("returns the unsubscribe, and the unsubscribe is the only teardown there is", () => {
		const missionsVM = createAtlasMissionsVM(fakeMissionGateway());
		const paints: number[] = [];
		const stop = bindAtlasVM(missionsVM, () => paints.push(1));

		stop();
		missionsVM.getState().goToPage(3);

		expect(paints).toHaveLength(1);
	});
});

describe("renderAtlasList", () => {
	it("replaces the children rather than appending to them", () => {
		const list = document.createElement("ul");
		renderAtlasList(list, ROWS, (row) => row.title);
		renderAtlasList(list, [ROWS[0]], (row) => row.title);

		expect([...list.children].map((item) => item.textContent)).toEqual([
			"Survey the north ridge",
		]);
	});

	it("empties the list when the rows run out", () => {
		const list = document.createElement("ul");
		renderAtlasList(list, ROWS, (row) => row.title);
		renderAtlasList(list, [], (row: IAtlasMission) => row.title);

		expect(list.childElementCount).toBe(0);
	});
});

describe("what is NOT in this application", () => {
	/**
	 * The scene no other playground can make.
	 *
	 * Everything else here proves lanka works inside a framework. This asserts
	 * there is no framework to be inside — read off this package's own sources and
	 * its own manifest, so it fails on the day somebody adds one rather than on
	 * the day a reader notices.
	 */
	const FRAMEWORKS = ["react", "react-dom", "vue", "svelte", "solid-js", "@angular/core"];

	const sourcesOf = (dir: string): string[] =>
		readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
			const path = join(dir, entry.name);

			return entry.isDirectory() ? sourcesOf(path) : path.endsWith(".ts") ? [path] : [];
		});

	it("imports no UI framework, in any source file", () => {
		const offenders = sourcesOf("src").flatMap((path) => {
			const source = readFileSync(path, "utf8");

			return FRAMEWORKS.filter((name) => source.includes(`from "${name}`)).map(
				(name) => `${path} imports ${name}`,
			);
		});

		expect(offenders).toEqual([]);
	});

	it("installs no UI framework, in its manifest", () => {
		// An import can be deleted while the dependency stays, and the dependency is
		// what a reader copying this as an example would copy.
		const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
		};
		const declared = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });

		expect(declared.filter((name) => FRAMEWORKS.some((ui) => name.startsWith(ui)))).toEqual([]);
		// The bindings shelf is five packages, and this application may hold none
		// of them: `useLankaVM` is the thing it exists to do without.
		expect(declared.filter((name) => name.startsWith("@lankajs/react"))).toEqual([]);
	});

	it("has no file a renderer would need", () => {
		expect(sourcesOf("src").filter((path) => path.endsWith(".tsx"))).toEqual([]);
	});
});
