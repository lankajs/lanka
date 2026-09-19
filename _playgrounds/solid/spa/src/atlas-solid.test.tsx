import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { waitFor } from "@testing-library/dom";
import { LankaError } from "lanka/errors";
import {
	AtlasBoardVM,
	createAtlasAvatarCache,
	createAtlasMissionsVM,
} from "@lanka-playgrounds/_shared";
import { lankaPrefetch } from "@lankajs/plugin-prefetch";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { AtlasApp } from "./App/AtlasApp";
import { AtlasBoardScreen } from "./Modules/AtlasBoardModule/AtlasBoardScreen";
import { AtlasMissionsScreen } from "./Modules/AtlasMissionsModule/AtlasMissionsScreen";
import { startAtlasSolid } from "./startAtlasSolid";
import type { IAtlasSolidApp } from "./startAtlasSolid";
import type {
	AtlasBoardGateway,
	AtlasMissionGateway,
	IAtlasMission,
} from "@lanka-playgrounds/_shared";

/**
 * A real plugin, watched rather than replaced.
 *
 * Nothing in the framework keeps a list of installed plugins, so "prefetch is
 * installed" has no reading to assert — only the call that installs it. `spy`
 * and not a stub for that reason: the plugin still does everything it does, and
 * what the scene pins is the one number with a reason attached to it.
 */
vi.mock("@lankajs/plugin-prefetch", { spy: true });

/**
 * Atlas in Solid, asserting what the other three applications assert.
 *
 * Deliberately the same claims in the same words. Four applications saying the
 * same sentences about the same ViewModels is what a `parallel` shelf means, and
 * reading them side by side should show only each framework's own syntax.
 *
 * No flush anywhere, and that absence is Solid's whole difference: there is no
 * render queue to drain, because an action's write reaches the DOM node that read
 * it synchronously. Every other suite in this folder has a `flushSync`, an
 * `act()` or a `nextTick` on nearly every line.
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

const ROWS: readonly IAtlasMission[] = [
	// One crewed row and one without, deliberately. A screen whose fixtures all
	// say `crewId: null` renders the avatar arm in no scene at all, and the guard
	// around it reports as working while nothing has ever gone through it.
	mission("m-1", { title: "Survey the north ridge", crewId: "c-1" }),
	mission("m-2", { title: "Restock the depot" }),
];

/**
 * A cache with no storage under it at all.
 *
 * The memory rung behaves exactly as no cache does, so a component test over it
 * is testing the component rather than IndexedDB — and `createObjectUrl` is
 * stubbed because jsdom has none, which is the same reason the real one is
 * allowed to answer nothing.
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
	render(() => <AtlasMissionsScreen missionsVM={missionsVM} avatars={avatars()} />);
	await missionsVM.getState().fetchMissions();

	return missionsVM;
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
		const input = screen.getByLabelText<HTMLInputElement>("Search missions");

		input.value = "ridge";
		fireEvent.input(input);

		// A whole round trip with only Solid's syntax in it: a handler called an
		// action, the ViewModel notified, and the node that read it changed.
		expect(missionsVM.getState().search).toBe("ridge");
		expect(screen.queryByText(/Restock the depot/)).toBeNull();
	});

	it("sorts by priority through the action", async () => {
		const missionsVM = await missionsScreen(fakeMissionGateway());

		fireEvent.click(screen.getByText("Sort by priority"));

		expect(missionsVM.getState().currentSort().field).toBe("priority");
	});

	it("completes a mission through the action, not through the gateway", async () => {
		// A screen that reached the gateway directly would take on the loading flag,
		// the retry and the rollback, and implement none of them.
		const gateway = fakeMissionGateway();
		await missionsScreen(gateway);

		fireEvent.click(screen.getByText("Complete AT-101"));

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

		fireEvent.click(screen.getByText("Next"));

		expect(missionsVM.getState().page).toBe(2);
	});
});

describe("the board screen, over the same ViewModel every other application reads", () => {
	it("paints the summary a gateway answered with", async () => {
		const boardVM = new AtlasBoardVM(fakeBoardGateway()).build();
		render(() => <AtlasBoardScreen boardVM={boardVM} />);

		await boardVM.getState().fetchSummary();

		expect(screen.getByTestId("board-summary").textContent).toBe("2 queued");
	});

	it("paints a message that arrived from somewhere else entirely", () => {
		const boardVM = new AtlasBoardVM(fakeBoardGateway()).build();
		render(() => <AtlasBoardScreen boardVM={boardVM} />);

		// `setState` and not an action, standing in for the scenario subscription a
		// live stream drives. The screen cannot tell the two apart, which is the
		// property that makes a ViewModel portable in the first place.
		boardVM.setState({ messages: [{ text: "ridge clear", at: "2026-09-15T00:00:00.000Z" }] });

		expect(screen.getByTestId("board-messages").textContent).toContain("ridge clear");
	});

	it("says so when there is no summary yet", () => {
		const boardVM = new AtlasBoardVM(fakeBoardGateway()).build();
		render(() => <AtlasBoardScreen boardVM={boardVM} />);

		expect(screen.getByTestId("board-summary").textContent).toBe("no summary");
	});
});

describe("the shell, over one started application", () => {
	const startedApp = () =>
		({
			app: { missionGateway: fakeMissionGateway(), boardGateway: fakeBoardGateway() },
		}) as unknown as IAtlasSolidApp;

	it("renders both screens", () => {
		render(() => <AtlasApp app={startedApp()} avatars={avatars()} />);

		expect(screen.getByLabelText("Missions")).toBeTruthy();
		expect(screen.getByLabelText("Board")).toBeTruthy();
	});

	it("can be mounted twice in one process", () => {
		// The ViewModels are built INSIDE the shell rather than at module level,
		// which is what lets this happen — a module-level ViewModel is one store per
		// PROCESS: right for a browser tab, wrong for a suite, and wrong for a
		// server.
		render(() => <AtlasApp app={startedApp()} avatars={avatars()} />);
		render(() => <AtlasApp app={startedApp()} avatars={avatars()} />);

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
		render(() => <AtlasMissionsScreen missionsVM={missionsVM} avatars={avatars()} />);

		const inFlight = missionsVM.getState().fetchMissions();

		expect(screen.getByRole("status").textContent).toContain("Loading");

		release([...ROWS]);
		await inFlight;

		expect(screen.queryByRole("status")).toBeNull();
	});

	it("moves BACK a page, which the first page can never reach", async () => {
		const manyRows = Array.from({ length: 25 }, (_, index) => mission(`m-${index + 1}`));
		const missionsVM = await missionsScreen(
			fakeMissionGateway({ list: vi.fn(() => Promise.resolve([...manyRows])) }),
		);
		fireEvent.click(screen.getByText("Next"));

		fireEvent.click(screen.getByText("Previous"));

		expect(missionsVM.getState().page).toBe(1);
	});

	it("DROPS the row a filter removed, and restores it", async () => {
		const missionsVM = await missionsScreen(fakeMissionGateway());

		missionsVM.getState().applySearch("depot");

		expect(screen.getAllByRole("listitem")).toHaveLength(1);

		missionsVM.getState().applySearch("");

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
		fireEvent.click(screen.getByText("Next"));

		expect(screen.getByTestId("page").textContent).toBe("2 / 9");

		missionsVM.getState().applySearch("depot");

		expect(screen.getByTestId("page").textContent).toBe("1 / 1");
	});
});

describe("a crew member's face, over the cache that holds it", () => {
	it("renders the cache's own answer for a row somebody is on", async () => {
		await missionsScreen(fakeMissionGateway());

		const avatar = screen.getByAltText<HTMLImageElement>("c-1");

		// The network URL on a first mount: nothing was cached yet, and nothing
		// upgrades an image that is already on screen. That IS the no-flicker
		// guarantee rather than a gap in it — `warmCache` fetches for the NEXT
		// mount, and the next mount is the one that reads a blob.
		expect(avatar.getAttribute("src")).toBe("/api/crew/c-1/avatar.png");
	});

	it("draws no face at all for a row nobody is on", async () => {
		await missionsScreen(fakeMissionGateway());

		// Two rows, one crew member. Without the guard the uncrewed row would ask
		// for `/api/crew/null/avatar.png`, which is a 404 per paint and a broken
		// image somebody has to explain.
		expect(screen.getAllByRole("img")).toHaveLength(1);
	});

	it("mounts a face for a row that arrived AFTER the screen did", async () => {
		// The scene the `<For>` rule exists for. A Solid component body runs once,
		// so an avatar built outside `<For>` would be built over the empty list the
		// screen mounted with — and every row loaded later would render faceless,
		// with nothing anywhere reporting it.
		const missionsVM = createAtlasMissionsVM(fakeMissionGateway());
		render(() => <AtlasMissionsScreen missionsVM={missionsVM} avatars={avatars()} />);

		expect(screen.queryAllByRole("img")).toHaveLength(0);

		await missionsVM.getState().fetchMissions();

		expect(screen.getByAltText("c-1")).toBeTruthy();
	});
});

/**
 * Start-up, with the wire stubbed at `fetch` and nothing else replaced.
 *
 * The live suite next door drives this same function against the REAL server and
 * is the file that proves the transport. What it cannot ask is whether the three
 * browser-only installs happened, because devtools is off unless the build says
 * development and the answer would then be about the live suite's flags rather
 * than about start-up. So this suite stubs the one seam that reaches the network
 * and asserts the wiring — which is all it claims to assert.
 */
describe("what the browser half of start-up installs", () => {
	const CREDENTIALS = { token: "t", refreshToken: "r", csrf: "c", name: "Ada" };

	const startWired = () => {
		vi.stubGlobal(
			"fetch",
			vi.fn((resource: unknown) =>
				Promise.resolve(
					new Response(
						JSON.stringify(String(resource).includes("/session") ? CREDENTIALS : []),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
				),
			),
		);

		return startAtlasSolid({
			apiBaseUrl: "http://atlas.test/api",
			connect: false,
			isDevelopment: true,
		});
	};

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("registers the read cache by NAME, so a screen resolves it rather than importing it", async () => {
		// `registerInstance` and not `register`: the locator builds a class with no
		// arguments, and the query client is an argument. A default would let a
		// second client exist without anybody noticing — and two clients disagree
		// on the first mutation, silently.
		const started = await startWired();

		expect(started.app.lanka.locators.singletons.get("AtlasReadCache")).toBe(started.cache);

		started.stop();
	});

	it("exposes the inspector under the name a console user has to type", async () => {
		const started = await startWired();

		const inspector = (globalThis as { __atlas?: { getSnapshot: () => unknown } }).__atlas;

		expect(inspector).toBeDefined();

		started.stop();

		// Removed again on teardown. An inspector left on `globalThis` after the
		// instance it watched is gone keeps that instance alive, and a leak with a
		// user interface is the hardest kind to notice.
		expect((globalThis as { __atlas?: unknown }).__atlas).toBeUndefined();
	});

	it("wraps the request layer, so one call the application made is one row", async () => {
		// The order is the claim: devtools is installed FIRST, so its middleware
		// sits OUTSIDE the retry policy. Inside it, a request that succeeded on its
		// second attempt would be two rows, and the panel would be describing the
		// ladder rather than the application.
		const started = await startWired();
		const inspector = (
			globalThis as { __atlas?: { getSnapshot: () => { requests: readonly unknown[] } } }
		).__atlas;

		await started.app.missionGateway.list();

		expect(inspector?.getSnapshot().requests).toHaveLength(1);

		started.stop();
	});

	it("installs the prefetch ladder with the intent buffer's own deadline", async () => {
		const started = await startWired();

		// The TTL is the number with a reason: a buffered response older than it is
		// a guess about a page the reader has already left, and serving it is worse
		// than fetching again.
		expect(vi.mocked(lankaPrefetch)).toHaveBeenCalledWith({ intent: { ttlMs: 20_000 } });

		started.stop();
	});
});
