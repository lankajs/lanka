import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { waitFor } from "@testing-library/dom";
import { flushSync } from "svelte";
import { LankaError } from "lanka/errors";
import { AtlasBoardVM, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import AtlasApp from "./App/AtlasApp.svelte";
import AtlasBoardScreen from "./Modules/AtlasBoardModule/AtlasBoardScreen.svelte";
import AtlasMissionsScreen from "./Modules/AtlasMissionsModule/AtlasMissionsScreen.svelte";
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

const ROWS: readonly IAtlasMission[] = [
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

const fakeBoardGateway = (): AtlasBoardGateway =>
	({
		summary: vi.fn(() => Promise.resolve({ queued: 2, active: 1, done: 0 })),
		post: vi.fn(() => Promise.resolve({ text: "ack", at: "2026-09-15T00:00:00.000Z" })),
	}) as unknown as AtlasBoardGateway;

const missionsScreen = async (gateway: AtlasMissionGateway) => {
	const missionsVM = createAtlasMissionsVM(gateway);
	render(AtlasMissionsScreen, { props: { missionsVM } });
	await missionsVM.getState().fetchMissions();
	flushSync();

	return missionsVM;
};

describe("a compiled component reading a ViewModel", () => {
	it("renders what the ViewModel holds", async () => {
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

	it("shows the failure the ViewModel named", async () => {
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

	it("routes a typed search through the ViewModel and back to the DOM", async () => {
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

	it("shows the page the ViewModel derived, and disables what cannot move", async () => {
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
		render(AtlasMissionsScreen, { props: { missionsVM } });

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
