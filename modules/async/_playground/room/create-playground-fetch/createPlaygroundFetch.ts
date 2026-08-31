import type { IPlaygroundParticipant } from "../../_interfaces/IPlaygroundParticipant";
import type { IPlaygroundServer } from "../../_interfaces/IPlaygroundServer";

/**
 * The request, with the one property the whole package is about: it may be SLOW.
 *
 * Out-of-order answers are not an edge case here, they are the subject — so the
 * delay lives with the request rather than in the room that consumes it.
 */
export const createPlaygroundFetch =
	(server: IPlaygroundServer) => async (): Promise<IPlaygroundParticipant[]> => {
		server.calls.push(server.calls.length + 1);

		if (server.delayMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, server.delayMs));
		}

		return [...server.participants];
	};
