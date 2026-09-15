import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import { waitFor } from "@testing-library/dom";
import { nextTick } from "vue";
import { LankaError } from "lanka/errors";
import { AtlasBoardVM, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import type { IAtlasVueApp } from "./startAtlasVue";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import AtlasApp from "./App/AtlasApp.vue";
import AtlasBoardScreen from "./Modules/AtlasBoardModule/AtlasBoardScreen.vue";
import AtlasMissionsScreen from "./Modules/AtlasMissionsModule/AtlasMissionsScreen.vue";
import type {
	AtlasBoardGateway,
	AtlasMissionGateway,
	IAtlasMission,
} from "@lanka-playgrounds/_shared";

/**
 * Atlas in Vue, asserting what `_playgrounds/react/spa` asserts.
 *
 * Deliberately the same claims in the same words. Two applications saying the
 * same sentences about the same ViewModels is what a `parallel` shelf means, and
 * reading them side by side should show only each framework's own syntax — a
 * single-file component here, JSX there.
 *
 * These render REAL `.vue` files, which is the half no binding suite covers: an
 * SFC goes through a compiler, and a compiler is what a consumer's build has and
 * a binding's does not.
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
	await nextTick();

	return missionsVM;
};

describe("a single-file component reading a ViewModel", () => {
	it("renders what the ViewModel holds", async () => {
		await missionsScreen(fakeMissionGateway());

		expect(screen.getByText(/Survey the north ridge/)).toBeTruthy();
		expect(screen.getByText(/Restock the depot/)).toBeTruthy();
	});

	it("shows what an action wrote, without being told to re-read", async () => {
		const missionsVM = await missionsScreen(fakeMissionGateway());

		missionsVM.getState().applySearch("depot");
		await nextTick();

		expect(screen.queryByText(/Survey the north ridge/)).toBeNull();
		expect(screen.getByText(/Restock the depot/)).toBeTruthy();
	});

	it("shows the failure the ViewModel named", async () => {
		// The screen owns no error state and catches nothing: the ViewModel decided
		// what a failure means, and the template reads the word it wrote.
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
		input.dispatchEvent(new Event("input"));
		await nextTick();

		// A whole round trip with only Vue's syntax in it: an event handler called
		// an action, the store notified, and the template re-read.
		expect(missionsVM.getState().search).toBe("ridge");
		expect(screen.queryByText(/Restock the depot/)).toBeNull();
	});

	it("pages through what the ViewModel derived", async () => {
		const missionsVM = await missionsScreen(fakeMissionGateway());

		expect(screen.getByTestId("page").textContent).toContain("1 /");
		expect(missionsVM.getState().rows().items).toHaveLength(2);
	});

	it("completes a mission through the action, not through the gateway", async () => {
		// A screen that reached the gateway directly would take on the loading flag,
		// the retry and the rollback, and implement none of them.
		const gateway = fakeMissionGateway();
		await missionsScreen(gateway);

		await fireEvent.click(screen.getByText("Complete AT-101"));

		// The FIRST argument only. The second is a deadline signal the framework
		// adds on the way out, and asserting the whole call would be this screen's
		// test failing the day a request policy gains an option.
		await waitFor(() => expect(gateway.complete).toHaveBeenCalled());
		expect(vi.mocked(gateway.complete).mock.calls[0]?.[0]).toBe("m-1");
	});
});

describe("the board screen, over the same ViewModel every other application reads", () => {
	it("paints the summary a gateway answered with", async () => {
		const boardVM = new AtlasBoardVM(fakeBoardGateway()).build();
		render(AtlasBoardScreen, { props: { boardVM } });

		await boardVM.getState().fetchSummary();
		await nextTick();

		expect(screen.getByTestId("board-summary").textContent).toBe("2 queued");
	});

	it("paints a message that arrived from somewhere else entirely", async () => {
		const boardVM = new AtlasBoardVM(fakeBoardGateway()).build();
		render(AtlasBoardScreen, { props: { boardVM } });

		// `setState` and not an action, standing in for the scenario subscription a
		// live stream drives. The screen cannot tell the two apart, which is the
		// property that makes a ViewModel portable in the first place.
		boardVM.setState({ messages: [{ text: "ridge clear", at: "2026-09-15T00:00:00.000Z" }] });
		await nextTick();

		expect(screen.getByTestId("board-messages").textContent).toContain("ridge clear");
	});

	it("says so when there is no summary yet", () => {
		const boardVM = new AtlasBoardVM(fakeBoardGateway()).build();
		render(AtlasBoardScreen, { props: { boardVM } });

		expect(screen.getByTestId("board-summary").textContent).toBe("no summary");
	});
});

describe("the shell, over one started application", () => {
	it("renders both screens", () => {
		// The ViewModels are built INSIDE the shell rather than at module level,
		// which is what lets this be mounted twice in one process — a module-level
		// ViewModel is one store per PROCESS: right for a browser tab, wrong for a
		// suite, and wrong for a server.
		const app = {
			app: {
				missionGateway: fakeMissionGateway(),
				boardGateway: fakeBoardGateway(),
			},
		} as unknown as IAtlasVueApp;

		render(AtlasApp, { props: { app } });

		expect(screen.getByLabelText("Missions")).toBeTruthy();
		expect(screen.getByLabelText("Board")).toBeTruthy();
	});

	it("can be mounted twice in one process", () => {
		const app = {
			app: {
				missionGateway: fakeMissionGateway(),
				boardGateway: fakeBoardGateway(),
			},
		} as unknown as IAtlasVueApp;

		render(AtlasApp, { props: { app } });
		render(AtlasApp, { props: { app } });

		expect(screen.getAllByLabelText("Missions")).toHaveLength(2);
	});
});

describe("the parts of the screen a reader drives", () => {
	it("sorts by priority through the action", async () => {
		const missionsVM = await missionsScreen(fakeMissionGateway());

		await fireEvent.click(screen.getByText("Sort by priority"));

		expect(missionsVM.getState().currentSort().field).toBe("priority");
	});

	it("moves a page through the action, and disables what cannot move", async () => {
		const missionsVM = await missionsScreen(fakeMissionGateway());

		// One page of two rows, so "Previous" and "Next" are both dead ends — and a
		// screen that let a reader press them would be asking the ViewModel for a
		// page it has already said does not exist.
		expect(screen.getByText("Previous").hasAttribute("disabled")).toBe(true);
		expect(screen.getByText("Next").hasAttribute("disabled")).toBe(true);
		expect(missionsVM.getState().page).toBe(1);
	});
});

describe("a board with more rows than a page holds", () => {
	const manyRows = Array.from({ length: 25 }, (_, index) => mission(`m-${index + 1}`));

	it("moves to the next page and back through the actions", async () => {
		// The paging buttons are the two handlers a one-page fixture can never
		// reach: with everything on one page a screen that let a reader press them
		// would be asking the ViewModel for a page it has said does not exist.
		const missionsVM = await missionsScreen(
			fakeMissionGateway({ list: vi.fn(() => Promise.resolve([...manyRows])) }),
		);

		expect(missionsVM.getState().rows().totalPages).toBeGreaterThan(1);

		await fireEvent.click(screen.getByText("Next"));
		expect(missionsVM.getState().page).toBe(2);

		await fireEvent.click(screen.getByText("Previous"));
		expect(missionsVM.getState().page).toBe(1);
	});

	it("shows the page the ViewModel derived, not one of its own", async () => {
		const missionsVM = await missionsScreen(
			fakeMissionGateway({ list: vi.fn(() => Promise.resolve([...manyRows])) }),
		);

		await fireEvent.click(screen.getByText("Next"));
		await nextTick();

		expect(screen.getByTestId("page").textContent).toContain("2 /");
		expect(missionsVM.getState().rows().items.length).toBeLessThan(manyRows.length);
	});
});
