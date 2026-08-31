import { LankaPolling } from "../../../src/index";
import { createLankaBurstCoalescer } from "../../../src/index";
import { createLankaLatestGuard } from "../../../src/index";
import { createPlaygroundFetch } from "../create-playground-fetch/createPlaygroundFetch";
import type { IPlaygroundParticipant } from "../../_interfaces/IPlaygroundParticipant";
import type { IPlaygroundServer } from "../../_interfaces/IPlaygroundServer";

/**
 * A live participant list, the way a realtime screen is actually built.
 *
 * All three residents of this package appear together because that is how they
 * are used: the guard decides which answer may be written to state, the
 * coalescer decides how many requests a burst produces, and polling fetches what
 * nobody pushes. Each on its own is a unit test; together they are this.
 */
export const createPlaygroundRoom = (server: IPlaygroundServer) => {
	const guard = createLankaLatestGuard();
	const coalescer = createLankaBurstCoalescer<string>();
	const polling = new LankaPolling();
	const fetchParticipants = createPlaygroundFetch(server);

	let participants: IPlaygroundParticipant[] = [];
	let writes = 0;

	/**
	 * Refreshes the list, writing state only when the answer is still current.
	 *
	 * The token is taken BEFORE the request and checked after: a burst of five
	 * events yields five requests whose answers may arrive in any order, and only
	 * the last one asked for may be written.
	 */
	const refresh = async (): Promise<void> => {
		const token = guard.start();
		const next = await fetchParticipants();
		if (!guard.isCurrent(token)) return;

		participants = next;
		writes += 1;
	};

	return {
		get participants(): IPlaygroundParticipant[] {
			return participants;
		},
		get writes(): number {
			return writes;
		},
		refresh,
		/** The same refresh, coalesced: a burst on one key produces ONE request. */
		refreshCoalesced: (key: string): Promise<void> => coalescer.run(key, refresh),
		startPolling: (intervalMs: number): string => polling.subscribe(refresh, intervalMs),
		stopPolling: (): void => {
			polling.clearAll();
		},
	};
};
