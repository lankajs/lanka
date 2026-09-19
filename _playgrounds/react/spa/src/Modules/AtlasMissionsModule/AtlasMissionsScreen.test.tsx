import { LankaError } from "lanka/errors";
import { createAtlasMissionsVM, createAtlasAvatarCache } from "@lanka-playgrounds/_shared";
import { renderWithLanka } from "@lankajs/react/testing";
import { screen, waitFor } from "@testing-library/dom";
import { act, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AtlasMissionsScreen } from "./AtlasMissionsScreen";
import type { AtlasMissionGateway, IAtlasMission } from "@lanka-playgrounds/_shared";
import type { TAtlasMissionsVM } from "@lanka-playgrounds/react-shared";

const mission = (id: string, over: Partial<IAtlasMission> = {}): IAtlasMission => ({
	id,
	code: `AT-10${id.replace(/\D/g, "")}`,
	title: `Mission ${id}`,
	status: "queued",
	priority: 3,
	crewId: null,
	updatedAt: "2026-09-13T00:00:00.000Z",
	...over,
});

const ROWS = [
	mission("m-1", { title: "Survey the north ridge", crewId: "c-1" }),
	mission("m-2", { title: "Restock the depot" }),
	mission("m-3", { title: "Repair the relay mast" }),
	mission("m-4", { title: "Map the flood plain" }),
];

const fakeGateway = (over: Partial<Record<string, unknown>> = {}) =>
	({
		list: vi.fn(() => Promise.resolve([...ROWS])),
		complete: vi.fn((id: string) => Promise.resolve(mission(id, { status: "done" }))),
		remove: vi.fn((id: string) => Promise.resolve({ id })),
		...over,
	}) as unknown as AtlasMissionGateway;

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

const renderScreen = async (gateway: AtlasMissionGateway) => {
	const missionsVM = createAtlasMissionsVM(gateway);
	const rendered = renderWithLanka(
		<AtlasMissionsScreen missionsVM={missionsVM} avatars={avatars()} />,
	);
	await waitFor(() => expect(screen.getByText("Survey the north ridge")).toBeDefined());

	return { ...rendered, missionsVM };
};

/**
 * A ViewModel that COUNTS the subscriptions standing on it.
 *
 * The only way to ask a binding whether it let go. Nothing in the framework
 * exposes a listener count — on purpose, since a count is a thing application
 * code would start branching on — so the count is kept out here, by a wrapper
 * that hands back the real ViewModel's own functions and one of its own.
 *
 * It counts DOWN as well as up, which is the half that earned its place: two
 * screens in this repository released what the binding had already released,
 * and a wrapper that clamped at zero would have called both of them correct.
 */
const watched = (viewModel: TAtlasMissionsVM) => {
	let live = 0;

	return {
		live: () => live,
		viewModel: {
			...viewModel,
			subscribe: (listener: Parameters<TAtlasMissionsVM["subscribe"]>[0]) => {
				live += 1;

				const stop = viewModel.subscribe(listener);

				return () => {
					live -= 1;
					stop();
				};
			},
		} as TAtlasMissionsVM,
	};
};

afterEach(() => {
	cleanup();
});

describe("AtlasMissionsScreen", () => {
	it("renders what the ViewModel loaded, and nothing it did not ask for", async () => {
		await renderScreen(fakeGateway());

		expect(screen.getByText("Restock the depot")).toBeDefined();
		// Four rows, three to a page: the fourth is on page two rather than
		// missing, and the footer says so.
		expect(screen.getByTestId("page").textContent).toBe("1 / 2");
	});

	it("shows a failure the ViewModel put there, and owns no error state of its own", async () => {
		// A `LankaError`, because that is what leaves a request. Anything else is
		// a bug in a handler, and the application RETHROWS those rather than
		// showing them: swallowing a `TypeError` into a banner is how a defect
		// becomes "the server is down".
		const missionsVM = createAtlasMissionsVM(
			fakeGateway({
				list: vi.fn(() =>
					Promise.reject(new LankaError({ kind: "network", message: "No connection" })),
				),
			}),
		);
		renderWithLanka(<AtlasMissionsScreen missionsVM={missionsVM} avatars={avatars()} />);

		await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("No connection"));
	});

	it("filters as somebody types", async () => {
		await renderScreen(fakeGateway());

		fireEvent.change(screen.getByLabelText("Search missions"), { target: { value: "depot" } });

		await waitFor(() => expect(screen.queryByText("Survey the north ridge")).toBeNull());
		expect(screen.getByText("Restock the depot")).toBeDefined();
	});

	it("pages, and cannot page past the end", async () => {
		await renderScreen(fakeGateway());

		fireEvent.click(screen.getByText("Next"));

		await waitFor(() => expect(screen.getByTestId("page").textContent).toBe("2 / 2"));
		expect(screen.getByText("Next").hasAttribute("disabled")).toBe(true);
	});

	it("sorts by priority through the action", async () => {
		// The button has been on this screen since it was written and nothing named
		// it: `check-playgrounds` found the gap when the four younger applications
		// were held to the same list, which is the entire argument for having one.
		//
		// The screen decides nothing here. It calls the action, and what "sorted"
		// means belongs to the ViewModel — a screen that sorted its own copy would
		// be a second answer to a question the ViewModel already answers.
		const { missionsVM } = await renderScreen(fakeGateway());

		fireEvent.click(screen.getByText("Sort by priority"));

		await waitFor(() => expect(missionsVM.getState().currentSort().field).toBe("priority"));
	});

	it("shows the loading status while a fetch is in flight", async () => {
		// The spinner belongs to the ViewModel, not to the screen: `isLoading` is a
		// key it writes, and the markup reads it. A screen with a flag of its own
		// would have two answers to one question.
		//
		// Neither this application nor React's had a scene for it, and both render
		// the arm — an `isLoading` nothing reads is a spinner that can be deleted
		// by accident and noticed by a user.
		let release: (rows: IAtlasMission[]) => void = () => undefined;
		const missionsVM = createAtlasMissionsVM(
			fakeGateway({
				list: vi.fn(
					() =>
						new Promise<IAtlasMission[]>((resolve) => {
							release = resolve;
						}),
				),
			}),
		);
		renderWithLanka(<AtlasMissionsScreen missionsVM={missionsVM} avatars={avatars()} />);

		await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Loading"));

		release([...ROWS]);

		await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
	});

	it("shows a completion the moment it is pressed, before the server answers", async () => {
		// The optimistic write is the point: the row changes now, and the request
		// happens behind it. Without that the button feels like the network.
		await renderScreen(fakeGateway());

		fireEvent.click(screen.getByText("Complete AT-102"));

		await waitFor(() => expect(screen.getByTestId("status-m-2").textContent).toBe("done"));
	});

	it("puts the row back when the server refuses", async () => {
		// The row has to be seen going to `done` FIRST, or this test passes over a
		// button that did nothing at all: `queued` is also the value it started at.
		let refuse: () => void = () => undefined;
		await renderScreen(
			fakeGateway({
				complete: vi.fn(
					() =>
						new Promise((_resolve, reject) => {
							refuse = () =>
								reject(new LankaError({ kind: "domain", message: "already done" }));
						}),
				),
			}),
		);

		fireEvent.click(screen.getByText("Complete AT-102"));
		await waitFor(() => expect(screen.getByTestId("status-m-2").textContent).toBe("done"));

		refuse();

		await waitFor(() => expect(screen.getByTestId("status-m-2").textContent).toBe("queued"));
	});

	it("renders a crew member's face from the cache's own answer", async () => {
		await renderScreen(fakeGateway());

		const avatar = screen.getByAltText("c-1");

		// The network URL on a first mount: nothing was cached yet, and nothing
		// upgrades an image that is already on screen. That IS the no-flicker
		// guarantee rather than a gap in it.
		expect(avatar.getAttribute("src")).toBe("/api/crew/c-1/avatar.png");
	});
});

/**
 * Three seams no scene in this repository touched, and one of them was a leak.
 *
 * Every other scene here reads a ViewModel through the tracked overload, from one
 * screen, and never takes the screen away. So three questions had no answer in
 * any application: whether the SELECTED overload works under a compiler, whether
 * a binding releases its subscription on unmount, and whether two screens over
 * one ViewModel both move. The binding packages answer them for themselves; what
 * nothing answered is whether they hold once a real build is in the way.
 */
describe("the seams between a binding and the ViewModel it reads", () => {
	it("counts through a SELECTOR, and keeps counting when the board is filtered away", async () => {
		// The selected read is not the tracked read with fewer keys: tracking is
		// BYPASSED, and what decides an update is whether the selector's answer
		// moved. All four fixture rows are queued, and filtering the list down to
		// one row changes what the board shows without changing that number.
		const { missionsVM } = await renderScreen(fakeGateway());

		expect(screen.getByTestId("queued-count").textContent).toBe("4 queued");

		act(() => missionsVM.getState().applySearch("depot"));

		await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
		expect(screen.getByTestId("queued-count").textContent).toBe("4 queued");

		act(() => missionsVM.setState({ missions: [mission("m-1", { status: "done" })] }));

		await waitFor(() =>
			expect(screen.getByTestId("queued-count").textContent).toBe("0 queued"),
		);
	});

	it("lets go of the ViewModel when the screen is taken away", async () => {
		// A binding that forgot this leaks the SCREEN, not the ViewModel: the
		// listener closes over the component, so a page that mounts and unmounts a
		// list a hundred times holds a hundred of them, and nothing anywhere
		// reports it.
		const { live, viewModel } = watched(createAtlasMissionsVM(fakeGateway()));
		const { unmount } = renderWithLanka(
			<AtlasMissionsScreen missionsVM={viewModel} avatars={avatars()} />,
		);
		await waitFor(() => expect(screen.getByText("Survey the north ridge")).toBeDefined());

		expect(live()).toBeGreaterThan(0);

		unmount();

		expect(live()).toBe(0);
	});

	it("moves two screens that read one ViewModel", async () => {
		// One store, two readers. A binding holding its subscription on the MODULE
		// rather than on the component would wake only one of them, and the second
		// would sit there correct-looking and stale — which is the bug a shared
		// ViewModel is supposed to make impossible.
		const missionsVM = createAtlasMissionsVM(fakeGateway());
		renderWithLanka(<AtlasMissionsScreen missionsVM={missionsVM} avatars={avatars()} />);
		renderWithLanka(<AtlasMissionsScreen missionsVM={missionsVM} avatars={avatars()} />);
		await waitFor(() => expect(screen.getAllByText("Restock the depot")).toHaveLength(2));

		act(() => missionsVM.getState().applySearch("ridge"));

		await waitFor(() => expect(screen.queryAllByText("Restock the depot")).toHaveLength(0));
		expect(screen.getAllByText("Survey the north ridge")).toHaveLength(2);
	});
});
