import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { waitFor } from "@testing-library/dom";
import { flushSync } from "svelte";
import { LankaError } from "lanka/errors";
import {
	AtlasBoardVM,
	atlasBoardMessagePosted,
	createAtlasAvatarCache,
	createAtlasMissionsVM,
} from "@lanka-playgrounds/_shared";
import { lankaPrefetch } from "@lankajs/plugin-prefetch";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import AtlasApp from "./App/AtlasApp.svelte";
import AtlasBoardScreen from "./Modules/AtlasBoardModule/AtlasBoardScreen.svelte";
import AtlasMissionsScreen from "./Modules/AtlasMissionsModule/AtlasMissionsScreen.svelte";
import { startAtlasSvelte } from "./startAtlasSvelte";
import type {
	AtlasBoardGateway,
	AtlasMissionGateway,
	IAtlasMission,
} from "@lanka-playgrounds/_shared";
import type { IAtlasSvelteApp } from "./startAtlasSvelte";

/**
 * Atlas in Svelte, asserting what React's and Vue's applications assert.
 *
 * Deliberately the same claims in the same words. Three applications saying the
 * same sentences about the same ViewModels is what a `parallel` shelf means, and
 * reading them side by side should show only each framework's own syntax — runes
 * here, a single-file component there, JSX in the third.
 *
 * These render REAL `.svelte` files, which is the half no binding suite covers:
 * a component goes through a COMPILER, and a compiler is what a consumer's build
 * has and a binding's does not.
 */
beforeEach(() => {
	resetActiveLanka();
	void startLanka({ host: lankaTestHost });
});

afterEach(() => {
	cleanup();
	resetActiveLanka();
});

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

/**
 * One crewed row and one without, deliberately.
 *
 * The avatar sits behind `crewId !== null`, and a fixture where every row is
 * uncrewed reaches neither arm of that: no face is rendered, and no scene would
 * notice if one were rendered for nobody.
 */
const ROWS: readonly IAtlasMission[] = [
	mission("m-1", { title: "Survey the north ridge", crewId: "c-1" }),
	mission("m-2", { title: "Restock the depot" }),
];

/**
 * A cache with no storage under it at all.
 *
 * The memory rung behaves exactly as no cache does, so a component test over it
 * is testing the component rather than IndexedDB — and `createObjectUrl` is
 * stubbed because jsdom has none, which is the same reason the real one is
 * allowed to answer `null`.
 */
const avatars = () =>
	createAtlasAvatarCache({
		indexedDb: undefined,
		caches: undefined,
		now: () => 0,
		createObjectUrl: () => "blob:atlas",
		revokeObjectUrl: () => undefined,
	});

const fakeMissionGateway = (over: Record<string, unknown> = {}): AtlasMissionGateway =>
	({
		list: vi.fn(() => Promise.resolve([...ROWS])),
		complete: vi.fn((id: string) => Promise.resolve(mission(id, { status: "done" }))),
		remove: vi.fn((id: string) => Promise.resolve({ id })),
		...over,
	}) as unknown as AtlasMissionGateway;

const fakeBoardGateway = (): AtlasBoardGateway =>
	({
		summary: vi.fn(() => Promise.resolve({ queued: 2, active: 1, done: 0 })),
		post: vi.fn(() => Promise.resolve({ text: "ack", at: "2026-09-15T00:00:00.000Z" })),
	}) as unknown as AtlasBoardGateway;

const missionsScreen = async (gateway: AtlasMissionGateway) => {
	const missionsVM = createAtlasMissionsVM(gateway);
	render(AtlasMissionsScreen, { props: { missionsVM, avatars: avatars() } });
	await missionsVM.getState().fetchMissions();
	flushSync();

	return missionsVM;
};

/**
 * The status cell inside the row whose complete button reads `code`.
 *
 * Found through the ROW rather than by a `status-${id}` testid, which is what
 * the other four applications use. A testid carrying the id is an attribute
 * Svelte compiles an update branch for, and a keyed `{#each}` never runs it —
 * one unreachable branch, and this package's coverage ratchet is the thing that
 * said so. Reading through the row also proves the status belongs to the row the
 * button acted on, which the testid only assumed.
 */
const statusOfRow = (code: string): HTMLElement => {
	const row = screen.getByText(`Complete ${code}`).closest("li");
	const status = row?.querySelector<HTMLElement>(".atlas-status");

	if (!status) throw new Error(`no status cell in the row for ${code}`);

	return status;
};

describe("a compiled component reading a ViewModel", () => {
	it("renders what the ViewModel loaded, and nothing it did not ask for", async () => {
		await missionsScreen(fakeMissionGateway());

		expect(screen.getByText(/Survey the north ridge/)).toBeTruthy();
		expect(screen.getByText(/Restock the depot/)).toBeTruthy();
	});

	it("shows what an action wrote, without being told to re-read", async () => {
		const missionsVM = await missionsScreen(fakeMissionGateway());

		missionsVM.getState().applySearch("depot");
		flushSync();

		expect(screen.queryByText(/Survey the north ridge/)).toBeNull();
		expect(screen.getByText(/Restock the depot/)).toBeTruthy();
	});

	it("shows a failure the ViewModel put there, and owns no error state of its own", async () => {
		// The screen owns no error state and catches nothing: the ViewModel decided
		// what a failure means, and the markup reads the word it wrote.
		const missionsVM = await missionsScreen(
			fakeMissionGateway({
				list: vi.fn(() =>
					Promise.reject(new LankaError({ kind: "network", message: "no route" })),
				),
			}),
		);

		expect(missionsVM.getState().error).not.toBeNull();
		expect(screen.getByRole("alert").textContent).toBe(missionsVM.getState().error);
	});

	it("filters as somebody types", async () => {
		const missionsVM = await missionsScreen(fakeMissionGateway());

		await fireEvent.input(screen.getByLabelText("Search missions"), {
			target: { value: "ridge" },
		});
		flushSync();

		// A whole round trip with only Svelte's syntax in it: a handler called an
		// action, the ViewModel notified, and the markup re-read.
		expect(missionsVM.getState().search).toBe("ridge");
		expect(screen.queryByText(/Restock the depot/)).toBeNull();
	});

	it("sorts by priority through the action", async () => {
		const missionsVM = await missionsScreen(fakeMissionGateway());

		await fireEvent.click(screen.getByText("Sort by priority"));

		expect(missionsVM.getState().currentSort().field).toBe("priority");
	});

	it("completes a mission through the action, not through the gateway", async () => {
		// A screen that reached the gateway directly would take on the loading flag,
		// the retry and the rollback, and implement none of them.
		const gateway = fakeMissionGateway();
		await missionsScreen(gateway);

		await fireEvent.click(screen.getByText("Complete AT-101"));

		// The FIRST argument only. The second is a deadline signal the framework
		// adds on the way out.
		await waitFor(() => expect(gateway.complete).toHaveBeenCalled());
		expect(vi.mocked(gateway.complete).mock.calls[0]?.[0]).toBe("m-1");
	});

	it("pages, and cannot page past the end", async () => {
		await missionsScreen(fakeMissionGateway());

		// One page of two rows, so both ends are dead — and a screen that let a
		// reader press them would be asking for a page the ViewModel has said does
		// not exist.
		expect(screen.getByTestId("page").textContent).toContain("1 /");
		expect(screen.getByText("Previous").hasAttribute("disabled")).toBe(true);
		expect(screen.getByText("Next").hasAttribute("disabled")).toBe(true);
	});

	it("moves a page when there is one to move to", async () => {
		const manyRows = Array.from({ length: 25 }, (_, index) => mission(`m-${index + 1}`));
		const missionsVM = await missionsScreen(
			fakeMissionGateway({ list: vi.fn(() => Promise.resolve([...manyRows])) }),
		);

		await fireEvent.click(screen.getByText("Next"));

		expect(missionsVM.getState().page).toBe(2);
	});
});

describe("the board screen, over the same ViewModel every other application reads", () => {
	it("paints the summary a gateway answered with", async () => {
		const boardVM = new AtlasBoardVM(fakeBoardGateway()).build();
		render(AtlasBoardScreen, { props: { boardVM } });

		await boardVM.getState().fetchSummary();
		flushSync();

		expect(screen.getByTestId("board-summary").textContent).toBe("2 queued");
	});

	it("paints a message that arrived from somewhere else entirely", () => {
		const boardVM = new AtlasBoardVM(fakeBoardGateway()).build();
		render(AtlasBoardScreen, { props: { boardVM } });

		// `setState` and not an action, standing in for the scenario subscription a
		// live stream drives. The screen cannot tell the two apart, which is the
		// property that makes a ViewModel portable in the first place.
		boardVM.setState({ messages: [{ text: "ridge clear", at: "2026-09-15T00:00:00.000Z" }] });
		flushSync();

		expect(screen.getByTestId("board-messages").textContent).toContain("ridge clear");
	});

	it("says so when there is no summary yet", () => {
		const boardVM = new AtlasBoardVM(fakeBoardGateway()).build();
		render(AtlasBoardScreen, { props: { boardVM } });

		expect(screen.getByTestId("board-summary").textContent).toBe("no summary");
	});
});

describe("the shell, over one started application", () => {
	const startedApp = () =>
		({
			app: { missionGateway: fakeMissionGateway(), boardGateway: fakeBoardGateway() },
			avatars: avatars(),
		}) as unknown as IAtlasSvelteApp;

	it("renders both screens", () => {
		render(AtlasApp, { props: { app: startedApp() } });

		expect(screen.getByLabelText("Missions")).toBeTruthy();
		expect(screen.getByLabelText("Board")).toBeTruthy();
	});

	it("can be mounted twice in one process", () => {
		// The ViewModels are built INSIDE the shell rather than at module level,
		// which is what lets this happen — a module-level ViewModel is one store per
		// PROCESS: right for a browser tab, wrong for a suite, and wrong for a
		// server.
		render(AtlasApp, { props: { app: startedApp() } });
		render(AtlasApp, { props: { app: startedApp() } });

		expect(screen.getAllByLabelText("Missions")).toHaveLength(2);
	});
});

describe("the arms a settled screen never shows", () => {
	it("shows the loading status while a fetch is in flight", async () => {
		// The spinner belongs to the ViewModel, not to the screen: `isLoading` is a
		// key it writes, and the markup reads it. A screen with a flag of its own
		// would have two answers to one question.
		let release: (rows: IAtlasMission[]) => void = () => undefined;
		const missionsVM = createAtlasMissionsVM(
			fakeMissionGateway({
				list: vi.fn(
					() =>
						new Promise<IAtlasMission[]>((resolve) => {
							release = resolve;
						}),
				),
			}),
		);
		render(AtlasMissionsScreen, { props: { missionsVM, avatars: avatars() } });

		const inFlight = missionsVM.getState().fetchMissions();
		flushSync();

		expect(screen.getByRole("status").textContent).toContain("Loading");

		release([...ROWS]);
		await inFlight;
		flushSync();

		expect(screen.queryByRole("status")).toBeNull();
	});

	it("moves BACK a page, which the first page can never reach", async () => {
		const manyRows = Array.from({ length: 25 }, (_, index) => mission(`m-${index + 1}`));
		const missionsVM = await missionsScreen(
			fakeMissionGateway({ list: vi.fn(() => Promise.resolve([...manyRows])) }),
		);
		await fireEvent.click(screen.getByText("Next"));
		flushSync();

		await fireEvent.click(screen.getByText("Previous"));

		expect(missionsVM.getState().page).toBe(1);
	});

	it("MOVES the rows a sort reordered, rather than rebuilding them", async () => {
		// A keyed `{#each}` is the reason this is worth asserting: given a key,
		// Svelte moves the existing DOM node instead of throwing it away, so a row
		// that kept its identity keeps its focus, its selection and its scroll
		// position. Every earlier scene sorted rows that all had priority 3, where
		// a reorder and a no-op look exactly alike.
		const missionsVM = await missionsScreen(
			fakeMissionGateway({
				list: vi.fn(() =>
					Promise.resolve([
						mission("m-1", { title: "Survey the north ridge", priority: 9 }),
						mission("m-2", { title: "Restock the depot", priority: 1 }),
					]),
				),
			}),
		);
		const before = screen.getByText(/Survey the north ridge/);

		missionsVM.getState().sortBy("priority");
		flushSync();

		const rows = screen.getAllByRole("listitem").map((row) => row.textContent ?? "");
		expect(rows[0]).toContain("Restock the depot");
		expect(screen.getByText(/Survey the north ridge/)).toBe(before);
	});

	it("DROPS the row a filter removed, and keeps the ones it did not", async () => {
		const missionsVM = await missionsScreen(fakeMissionGateway());

		missionsVM.getState().applySearch("depot");
		flushSync();

		expect(screen.getAllByRole("listitem")).toHaveLength(1);

		// And back: the removed row returns as a NEW node, because its old one is
		// gone — which is what a key promises and what it does not.
		missionsVM.getState().applySearch("");
		flushSync();

		expect(screen.getAllByRole("listitem")).toHaveLength(2);
	});

	it("repaints the page COUNT when a filter makes pages disappear underneath a reader", async () => {
		// Being stranded on page 2 of a list that now has one page is the bug this
		// scene exists for, and it is the ViewModel's answer either way — the screen
		// only re-reads `totalPages`, which nothing else here makes change.
		const manyRows = Array.from({ length: 25 }, (_, index) =>
			mission(`m-${index + 1}`, {
				title: index === 0 ? "Restock the depot" : `Mission ${index}`,
			}),
		);
		const missionsVM = await missionsScreen(
			fakeMissionGateway({ list: vi.fn(() => Promise.resolve([...manyRows])) }),
		);
		await fireEvent.click(screen.getByText("Next"));
		flushSync();

		expect(screen.getByTestId("page").textContent).toBe("2 / 9");

		missionsVM.getState().applySearch("depot");
		flushSync();

		expect(screen.getByTestId("page").textContent).toBe("1 / 1");
	});
});

describe("a crew member's face, out of the blob cache", () => {
	it("renders the cache's own answer, and never a second one", async () => {
		await missionsScreen(fakeMissionGateway());

		const avatar = screen.getByAltText("c-1");

		// The network URL on a first mount: nothing was cached yet, and nothing
		// upgrades an image that is already on screen. That IS the no-flicker
		// guarantee rather than a gap in it.
		expect(avatar.getAttribute("src")).toBe("/api/crew/c-1/avatar.png");
	});

	it("renders no face at all for a row nobody is on", async () => {
		// The other arm of `crewId !== null`, and the one a fixture of crewed rows
		// would never reach: an `<img>` with no crew member behind it is an alt
		// text of `null` and a request for `/api/crew/null/avatar.png`.
		await missionsScreen(fakeMissionGateway());

		const rows = screen.getAllByRole("listitem");

		expect(rows[0]?.querySelector("img")).not.toBeNull();
		expect(rows[1]?.querySelector("img")).toBeNull();
	});
});

describe("the start-up, with every browser-side package it installs", () => {
	const CREDENTIALS = { token: "t-1", refreshToken: "r-1", csrf: "x-1", name: "Ada" };

	/**
	 * The wire stubbed, rather than the real server started.
	 *
	 * What this file asserts is the WIRING — which packages the start-up installs
	 * and in which order — and that is a question about this application rather
	 * than about the API. The live suite beside it starts the real server and
	 * answers the other half; running one there and the other here is the division
	 * every application in this folder ends up making.
	 *
	 * `signInAs: "Ada"` is baked into the start-up, so exactly one request leaves:
	 * the bootstrap chain's `POST /session`. A stub is also what keeps jsdom
	 * honest here — node's `fetch` refuses a signal built in jsdom's realm, and
	 * every request the framework sends carries one.
	 */
	const answering = (): typeof fetch =>
		vi.fn(() =>
			Promise.resolve(
				new Response(JSON.stringify(CREDENTIALS), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
			),
		);

	const start = async (): Promise<IAtlasSvelteApp> => {
		vi.stubGlobal("fetch", answering());

		return await startAtlasSvelte({
			apiBaseUrl: "http://atlas.test/api",
			connect: false,
			// The inspector is development-only by default, and "installed" is not a
			// thing that can be asserted about a plugin that decided to do nothing.
			isDevelopment: true,
		});
	};

	let started: IAtlasSvelteApp | null = null;

	afterEach(() => {
		started?.stop();
		started = null;
		vi.unstubAllGlobals();
	});

	it("registers the read cache by the name the ViewModels resolve", async () => {
		started = await start();

		// The nanostores member, where React, Vue and Solid install the TanStack
		// one. They are one `parallel` family over one port, and an application
		// swapping a member and changing nothing above it is the only proof that
		// the family is interchangeable — a conformance suite checks one member
		// against the port, never two members against each other.
		expect(started.app.lanka.locators.singletons.get("atlasReadCache")).toBe(started.cache);
	});

	it("reads one resource once when two screens ask for it", async () => {
		// The slot a host framework would fill. In a plain single-page application
		// it is empty, and without a cache two screens reading one resource send
		// two requests and grow two independently ageing copies.
		started = await start();
		let reads = 0;
		const load = () => {
			reads += 1;

			return Promise.resolve(["m-1"]);
		};

		await started.cache.read(["missions"], load, { staleMs: 30_000 });
		await started.cache.read(["missions"], load, { staleMs: 30_000 });

		expect(reads).toBe(1);
	});

	it("puts the inspector where a console can reach it", async () => {
		started = await start();

		// `exposeAs` is the whole observable half of installing devtools: a NAME
		// rather than a flag, because what somebody at a console needs to know is
		// what to type.
		expect((globalThis as Record<string, unknown>)["__atlas"]).toBeDefined();
	});

	it("takes the inspector away again when the application stops", async () => {
		started = await start();

		started.stop();
		started = null;

		// A global left behind holds the collector, which holds every log line it
		// ever saw — a leak nothing in a running application would show.
		expect((globalThis as Record<string, unknown>)["__atlas"]).toBeUndefined();
	});

	it("occupies the prefetch slot, so a second ladder cannot be installed over it", async () => {
		started = await start();

		// The plugin registry refuses a duplicate NAME, and that refusal is what
		// makes "the ladder is installed" assertable from outside: a prefetch
		// plugin has no state a caller can read, but the slot it took is visible.
		// Two copies of one policy is the failure being prevented — two ladders
		// double the traffic they exist to hold back.
		expect(() => started?.app.lanka.use(lankaPrefetch())).toThrow(/already registered/);
	});
});

describe("a fact from outside, through the whole scenario layer", () => {
	it("shows a message somebody ELSE posted, which arrived as a fact", () => {
		// The scene the board's older one only stood in for. `setState` proves the
		// screen re-reads; it does not prove the path a live stream actually uses —
		// scenario triggered, handler run, ViewModel written, binding notified.
		//
		// Nothing here touches the ViewModel. That is the point: every other scene
		// in this file moves the screen by calling something the screen can see, and
		// a binding that only notified on its own actions would pass all of them.
		const boardVM = new AtlasBoardVM(fakeBoardGateway()).build();
		render(AtlasBoardScreen, { props: { boardVM } });

		atlasBoardMessagePosted.trigger({ text: "ridge clear", at: "2026-09-15T00:00:00.000Z" });
		flushSync();

		expect(screen.getByTestId("board-messages").textContent).toContain("ridge clear");
	});
});

describe("the optimistic write, and the rollback behind it", () => {
	it("shows a completion the moment it is pressed, before the server answers", async () => {
		// The optimistic write is the point: the row changes now, and the request
		// happens behind it. Without that the button feels like the network.
		//
		// It is also the hardest thing to ask of a binding, because it needs TWO
		// notifications in order — the optimistic one and the server's — and a
		// binding that coalesced them would show only the second.
		const missionsVM = await missionsScreen(fakeMissionGateway());

		await fireEvent.click(screen.getByText("Complete AT-102"));
		flushSync();

		expect(statusOfRow("AT-102").textContent).toBe("done");
		expect(missionsVM.getState().error).toBeNull();
	});

	it("puts the row back when the server refuses", async () => {
		// The rejection is HELD rather than immediate, and that is the difference
		// between testing the claim and racing it. A gateway that rejects on the
		// spot rolls back within the same microtask the click yielded, so the
		// optimistic row is never observable and the scene reads as "the button did
		// nothing" — which is also what a broken optimistic write looks like.
		//
		// The row has to be seen going to `done` FIRST, or this passes over a button
		// that did nothing at all: `queued` is also the value it started at.
		let refuse: (reason: unknown) => void = () => undefined;
		await missionsScreen(
			fakeMissionGateway({
				complete: vi.fn(
					() =>
						new Promise((_resolve, reject) => {
							refuse = reject;
						}),
				),
			}),
		);

		await fireEvent.click(screen.getByText("Complete AT-102"));
		flushSync();

		expect(statusOfRow("AT-102").textContent).toBe("done");

		refuse(new LankaError({ kind: "network", message: "no route" }));

		await waitFor(() => {
			flushSync();
			expect(statusOfRow("AT-102").textContent).toBe("queued");
		});
	});
});
