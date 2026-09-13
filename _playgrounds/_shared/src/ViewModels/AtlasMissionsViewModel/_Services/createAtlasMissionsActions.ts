import { lankaLogger } from "lanka/logger";
import { createLankaBurstCoalescer, createLankaLatestGuard } from "@lankajs/async";
import { createLankaOptimisticActions } from "@lankajs/optimistic";
import { nextLankaSortState } from "@lankajs/collection";
import { readAtlasFailure } from "../../../Core/Failures/readAtlasFailure";
import { atlasMissionCompleted } from "../../../Scenarios/Scenarios/AtlasMissionCompleted/AtlasMissionCompleted";
import { replaceAtlasMission } from "./replaceAtlasMission";
import type { createAtlasMissionView } from "./createAtlasMissionView";
import type { IAtlasMissionGateways } from "../createAtlasMissionsVM";
import type { IAtlasMissionsActions } from "../../../Core/Interfaces/IAtlasMissionsActions";
import type { IAtlasMissionsState } from "../../../Core/Interfaces/IAtlasMissionsState";
import type { ILankaScenarioVM } from "lanka/scenario";
import type { ILankaVMContext } from "lanka/viewmodel";

/** How many rows a page of the board holds. */
const PAGE_SIZE = 3;

/** The context this ViewModel's actions are written over. */
type TContext = ILankaVMContext<
	IAtlasMissionsState & IAtlasMissionsActions & ILankaScenarioVM,
	IAtlasMissionGateways,
	Record<string, never>
>;

/**
 * Everything the missions screen can do.
 *
 * Three coordination tools live here and each answers a different problem, which
 * is the reason they are all three present rather than one being enough:
 *
 * - **the guard** decides WHICH answer may write to state. A burst of events
 *   produces several reads of one list and nothing orders the answers, so
 *   without a version a screen can end up showing the first response because it
 *   arrived last — the state before the change those events announced;
 * - **the coalescer** decides HOW MANY requests a burst sends. Leading plus
 *   trailing, so the last request is guaranteed to see everything the burst
 *   announced;
 * - **the optimistic actions** decide what happens when a person presses twice.
 *
 * They compose without knowing about each other, and none of them is a
 * substitute for another: the guard makes a burst correct, the coalescer makes
 * it cheap.
 */
export const createAtlasMissionsActions = (
	{ set, get, gateways, trigger }: TContext,
	view: ReturnType<typeof createAtlasMissionView>,
): IAtlasMissionsActions => {
	const guard = createLankaLatestGuard();
	const coalescer = createLankaBurstCoalescer<string>();
	const optimistic = createLankaOptimisticActions();

	/** The read both `fetch` and `refresh` do. One of them shows a spinner. */
	const read = async (): Promise<void> => {
		// The token is taken BEFORE the request. After it, every response looks
		// current and the guard protects nothing.
		const token = guard.start();
		const missions = await gateways.missionGateway.list();

		if (!guard.isCurrent(token)) return;

		set({ missions, refreshes: get().refreshes + 1 });
	};

	return {
		fetchMissions: async () => {
			set({ isLoading: true, error: null });
			try {
				await read();
			} catch (failure) {
				set({ error: readAtlasFailure(failure) });
			} finally {
				set({ isLoading: false });
			}
		},

		// Silent, and collapsed: a burst of server events about one board must not
		// become a burst of identical reads competing with the screen's own data.
		//
		// Silent about its FAILURE too, and that is the part worth stating. The
		// callers are scenario handlers, and a handler returns `void` — there is
		// nowhere for it to put a rejection, so this action owns the failure or
		// nobody does, and "nobody" means an unhandled rejection surfacing in
		// whatever code happened to run next.
		//
		// Swallowed rather than shown: a background read nobody asked for has no
		// standing to put an error banner over a list that is still perfectly
		// readable. What the reader has stays on screen, and the next event — or
		// their own next action, which DOES report — tries again.
		refreshMissions: async () => {
			try {
				await coalescer.run("missions", read);
			} catch (failure) {
				lankaLogger.printViewModelLog(
					"atlas: a silent refresh failed",
					readAtlasFailure(failure),
				);
			}
		},

		applyMission: (mission) => {
			set({ missions: replaceAtlasMission(get().missions, mission) });
		},

		applySearch: (term) => {
			// Back to the first page, always. A search that left the reader on page
			// four of a two-page result shows an empty screen and no reason.
			set({ search: term, page: 1 });
		},

		sortBy: (field) => {
			// Three states, not two: ascending, descending, and off. The third is
			// the only way back to the order the server sent.
			set({ sort: nextLankaSortState(get().sort, field) });
		},

		goToPage: (page) => {
			set({ page });
		},

		completeMission: (id) =>
			optimistic.runLatest(
				// The key carries the entity id. Two missions sharing one key means
				// completing one silently cancels the other.
				`mission:${id}:complete`,
				() => {
					// The snapshot is taken BEFORE the optimistic write, or the
					// rollback restores the change it was undoing.
					const previous = get().missions;
					const mission = previous.find((one) => one.id === id);
					if (mission) {
						set({
							missions: replaceAtlasMission(previous, { ...mission, status: "done" }),
						});
					}

					return previous;
				},
				// The signal reaches the gateway, or nothing is actually cancelled:
				// the superseded request still runs, still costs a connection, and
				// is simply ignored.
				(signal) => gateways.missionGateway.complete(id, { signal }),
				(previous) => set({ missions: previous }),
				(saved) => {
					set({ missions: replaceAtlasMission(get().missions, saved) });
					// Announced AFTER our own state is marked, so a handler hearing
					// its own save recognises it — and WITH the data, so subscribers
					// apply it instead of each refetching.
					trigger(atlasMissionCompleted, { id, mission: saved });
				},
			),

		removeMission: async (id) => {
			// `runExclusive`, not `runLatest`: a superseded delete does not roll
			// back, so the row would stay gone on a screen whose request never
			// happened.
			const outcome = await optimistic.runExclusive(
				`mission:${id}:remove`,
				() => {
					const previous = get().missions;
					set({ missions: previous.filter((one) => one.id !== id) });

					return previous;
				},
				(signal) => gateways.missionGateway.remove(id, { signal }),
				(previous) => set({ missions: previous }),
			);

			// Three outcomes, not a boolean: "not run, already in flight" and "run
			// and failed" have to be handled in opposite ways — the first silently,
			// the second with a message — and a boolean cannot tell them apart.
			return outcome === "executed" ? "done" : outcome;
		},

		rows: () => {
			const { missions, search, sort, page } = get();

			// Four calls, in the order this screen means. Paginating before
			// filtering would be a different page, and only the screen knows which.
			const found = view.filter(missions, search ? [{ field: "title", value: search }] : []);
			const ordered = view.sort(found, sort);

			// Stabilise AFTER sorting and filtering, and before rendering: it hands
			// back the previous object for every row whose contents are unchanged,
			// so a memoised row does not re-render because a refetch made a new one.
			return view.paginate(view.stabilise(ordered), page, PAGE_SIZE);
		},

		currentSort: () => get().sort,
	};
};
