import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { waitFor } from "@testing-library/dom";
import { LankaError } from "lanka/errors";
import { AtlasBoardVM, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { AtlasApp } from "./App/AtlasApp";
import { AtlasBoardScreen } from "./Modules/AtlasBoardModule/AtlasBoardScreen";
import { AtlasMissionsScreen } from "./Modules/AtlasMissionsModule/AtlasMissionsScreen";
import type {
	AtlasBoardGateway,
	AtlasMissionGateway,
	IAtlasMission,
} from "@lanka-playgrounds/_shared";
import type { IAtlasSolidApp } from "./startAtlasSolid";

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
	render(() => <AtlasMissionsScreen missionsVM={missionsVM} />);
	await missionsVM.getState().fetchMissions();

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
		render(() => <AtlasApp app={startedApp()} />);

		expect(screen.getByLabelText("Missions")).toBeTruthy();
		expect(screen.getByLabelText("Board")).toBeTruthy();
	});

	it("can be mounted twice in one process", () => {
		// The ViewModels are built INSIDE the shell rather than at module level,
		// which is what lets this happen — a module-level ViewModel is one store per
		// PROCESS: right for a browser tab, wrong for a suite, and wrong for a
		// server.
		render(() => <AtlasApp app={startedApp()} />);
		render(() => <AtlasApp app={startedApp()} />);

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
		render(() => <AtlasMissionsScreen missionsVM={missionsVM} />);

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
