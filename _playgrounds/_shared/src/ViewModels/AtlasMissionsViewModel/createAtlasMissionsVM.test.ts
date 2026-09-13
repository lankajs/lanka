import { LankaError } from "lanka/errors";
import { lankaScenarioBootstrap } from "lanka/scenario";
import { resetLanka } from "@lankajs/tool-testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAtlasMissionsVM } from "./createAtlasMissionsVM";
import { atlasMissionAssigned } from "../../Scenarios/Scenarios/AtlasMissionAssigned/atlasMissionAssigned";
import { atlasMissionCompleted } from "../../Scenarios/Scenarios/AtlasMissionCompleted/AtlasMissionCompleted";
import { atlasSessionEnded } from "../../Scenarios/Scenarios/AtlasSessionEnded/atlasSessionEnded";
import { atlasStreamReconnected } from "../../Scenarios/Scenarios/AtlasStreamReconnected/atlasStreamReconnected";
import type { AtlasMissionGateway } from "../../Gateways/AtlasMissionGateway/AtlasMissionGateway";
import type { IAtlasMission } from "../../Core/Interfaces/IAtlasMission";

const mission = (id: string, over: Partial<IAtlasMission> = {}): IAtlasMission => ({
	id,
	code: `AT-1${id.replace(/\D/g, "")}`,
	title: `Mission ${id}`,
	status: "queued",
	priority: 3,
	crewId: null,
	updatedAt: "2026-09-13T00:00:00.000Z",
	...over,
});

const ROWS = [
	mission("m-1", { title: "Survey the north ridge", priority: 1 }),
	mission("m-2", { title: "Restock the depot", priority: 3 }),
	mission("m-3", { title: "Repair the relay mast", priority: 2 }),
	mission("m-4", { title: "Map the flood plain", priority: 5 }),
];

/**
 * A double, not a subclass.
 *
 * A double does not have to extend `ALankaGateway` — that it does not is the
 * whole reason they are cheap to write, and the ViewModel is typed against what
 * it calls rather than against an implementation.
 */
const fakeGateway = (over: Partial<Record<string, unknown>> = {}) =>
	({
		list: vi.fn(() => Promise.resolve([...ROWS])),
		complete: vi.fn((id: string) => Promise.resolve(mission(id, { status: "done" }))),
		remove: vi.fn((id: string) => Promise.resolve({ id })),
		...over,
	}) as unknown as AtlasMissionGateway;

/**
 * A ViewModel with its scenarios actually bound.
 *
 * The order is the whole point and it is the order an application must use:
 * construct the ViewModel, THEN bootstrap. Binding happens inside bootstrap and
 * it binds what exists when it runs — a ViewModel built afterwards is a
 * ViewModel whose handlers never fire, silently.
 */
const bound = async (gateway: AtlasMissionGateway) => {
	const useVM = createAtlasMissionsVM(gateway);
	// Reading the state is what BUILDS the store, and building is what registers
	// it with the scenario bootstrap.
	useVM.getState();
	await resetLanka().bootstrap();
	lankaScenarioBootstrap.bootstrap();

	return useVM;
};

describe("createAtlasMissionsVM", () => {
	let gateway: AtlasMissionGateway;
	let useVM: ReturnType<typeof createAtlasMissionsVM>;

	beforeEach(() => {
		gateway = fakeGateway();
		useVM = createAtlasMissionsVM(gateway);
	});

	const state = () => useVM.getState();

	it("shows a spinner while fetching and clears it afterwards", async () => {
		const pending = state().fetchMissions();

		expect(state().isLoading).toBe(true);
		await pending;
		expect(state().isLoading).toBe(false);
		expect(state().missions).toHaveLength(4);
	});

	it("puts a failure on the screen rather than throwing at whoever pressed", async () => {
		const failing = createAtlasMissionsVM(
			fakeGateway({
				list: vi.fn(() =>
					Promise.reject(new LankaError({ kind: "network", message: "No connection" })),
				),
			}),
		);

		await failing.getState().fetchMissions();

		expect(failing.getState().error).toBe("No connection");
		expect(failing.getState().isLoading).toBe(false);
	});

	it("says nothing about a call the user cancelled", async () => {
		const aborted = createAtlasMissionsVM(
			fakeGateway({
				list: vi.fn(() =>
					Promise.reject(new LankaError({ kind: "aborted", message: "aborted" })),
				),
			}),
		);

		await aborted.getState().fetchMissions();

		expect(aborted.getState().error).toBeNull();
	});

	it("refreshes silently, which is what a server event asks for", async () => {
		await state().refreshMissions();

		expect(state().missions).toHaveLength(4);
		expect(state().isLoading).toBe(false);
	});

	it("keeps the readable list when a silent refresh fails, and does not reject", async () => {
		// The only callers of a silent refresh are scenario handlers, and a handler
		// returns `void`: there is nowhere for it to put a rejection. So the action
		// owns its own failure, or nobody does — and "nobody" means the process,
		// through an unhandled rejection raised in whatever code ran next.
		const failing = createAtlasMissionsVM(
			fakeGateway({
				list: vi
					.fn()
					// The first read succeeds, so there IS a readable list to protect.
					.mockResolvedValueOnce([...ROWS])
					.mockImplementation(() =>
						Promise.reject(new LankaError({ kind: "network", message: "gone" })),
					),
			}),
		);

		await failing.getState().fetchMissions();
		await failing.getState().refreshMissions();

		// The list the reader was already looking at, not a blank screen and not an
		// error banner over data that is still true.
		expect(failing.getState().missions).toHaveLength(4);
		expect(failing.getState().error).toBeNull();
	});

	it("collapses a burst of refreshes into at most two reads", async () => {
		// Leading plus trailing, not plain deduplication: if every event of a burst
		// arrived while the first request was in flight, dropping them would leave
		// the state reflecting a read made BEFORE the last change.
		await Promise.all([
			state().refreshMissions(),
			state().refreshMissions(),
			state().refreshMissions(),
			state().refreshMissions(),
		]);

		expect(vi.mocked(gateway.list).mock.calls.length).toBeLessThanOrEqual(2);
	});

	it("pages the rows, so a screen renders a page rather than a list", async () => {
		await state().fetchMissions();

		const page = state().rows();

		expect(page.items).toHaveLength(3);
		expect(page.totalPages).toBe(2);
	});

	it("filters by what somebody typed, and goes back to the first page", async () => {
		await state().fetchMissions();
		state().goToPage(2);

		state().applySearch("depot");

		expect(state().page).toBe(1);
		expect(
			state()
				.rows()
				.items.map((one) => one.id),
		).toEqual(["m-2"]);
	});

	it("sorts in three states, because the third is the way back", async () => {
		await state().fetchMissions();

		state().sortBy("priority");
		expect(state().rows().items[0].priority).toBe(1);

		state().sortBy("priority");
		expect(state().rows().items[0].priority).toBe(5);

		state().sortBy("priority");
		expect(state().currentSort().order).toBeNull();
	});

	it("hands back the SAME row object when nothing about it changed", async () => {
		// Identity, not equality: a new object for an unchanged row is a new prop
		// for every memoised row component below it.
		await state().fetchMissions();
		const before = state().rows().items[0];

		await state().refreshMissions();

		expect(state().rows().items[0]).toBe(before);
	});

	it("applies a completion the moment it is pressed, and announces it after", async () => {
		await state().fetchMissions();

		await state().completeMission("m-2");

		expect(state().missions.find((one) => one.id === "m-2")?.status).toBe("done");
	});

	it("rolls a completion back when the server refuses", async () => {
		const refusing = createAtlasMissionsVM(
			fakeGateway({
				complete: vi.fn(() =>
					Promise.reject(new LankaError({ kind: "domain", message: "already done" })),
				),
			}),
		);
		await refusing.getState().fetchMissions();

		await refusing.getState().completeMission("m-2");

		expect(refusing.getState().missions.find((one) => one.id === "m-2")?.status).toBe("queued");
	});

	it("refuses a second delete of one mission rather than sending it twice", async () => {
		await state().fetchMissions();
		let release: () => void = () => undefined;
		const slow = createAtlasMissionsVM(
			fakeGateway({
				remove: vi.fn(
					() =>
						new Promise((resolve) => {
							release = () => resolve({ id: "m-2" });
						}),
				),
			}),
		);
		await slow.getState().fetchMissions();

		const first = slow.getState().removeMission("m-2");
		const second = await slow.getState().removeMission("m-2");
		release();
		await first;

		// "Not run, already in flight" and "run and failed" are handled in
		// opposite ways — the first silently — and a boolean cannot tell them apart.
		expect(second).toBe("blocked");
	});

	it("applies a mission a scenario carried, rather than refetching for it", async () => {
		// The fact carries the data when the server returned it. A subscriber that
		// refetched on every announcement would turn one save into N requests.
		useVM = await bound(gateway);
		await state().fetchMissions();

		atlasMissionCompleted.trigger({
			id: "m-1",
			mission: mission("m-1", { title: "Survey the north ridge", status: "done" }),
		});

		expect(state().missions.find((one) => one.id === "m-1")?.status).toBe("done");
		expect(vi.mocked(gateway.list)).toHaveBeenCalledTimes(1);
	});

	it("applies an assignment the same way", async () => {
		useVM = await bound(gateway);
		await state().fetchMissions();

		atlasMissionAssigned.trigger({
			id: "m-2",
			crewId: "c-3",
			mission: mission("m-2", { crewId: "c-3" }),
		});

		expect(state().missions.find((one) => one.id === "m-2")?.crewId).toBe("c-3");
	});

	it("ignores a fact that carried no mission", async () => {
		useVM = await bound(gateway);
		await state().fetchMissions();

		atlasMissionCompleted.trigger({ id: "m-1" });

		expect(state().missions.find((one) => one.id === "m-1")?.status).toBe("queued");
	});

	it("catches up silently when a wire comes back", async () => {
		// A gap in what this screen was told. A skeleton over a readable list, for
		// a reconnection nobody asked for, reads as the application breaking rather
		// than recovering.
		useVM = await bound(gateway);
		await state().fetchMissions();
		const reads = vi.mocked(gateway.list).mock.calls.length;

		atlasStreamReconnected.trigger({ wire: "events" });
		await vi.waitFor(() =>
			expect(vi.mocked(gateway.list).mock.calls.length).toBeGreaterThan(reads),
		);

		expect(state().isLoading).toBe(false);
	});

	it("empties itself when the session ends, because that is ITS decision", async () => {
		// What a fact means differs per screen, which is why the service that
		// noticed the token was gone did not call this ViewModel.
		useVM = await bound(gateway);
		await state().fetchMissions();

		atlasSessionEnded.trigger({ reason: "expired" });

		expect(state().missions).toEqual([]);
		expect(state().page).toBe(1);
	});
});
