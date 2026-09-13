import type { AtlasIdempotency } from "../atlas-idempotency/AtlasIdempotency";
import type { AtlasSessions } from "../atlas-sessions/AtlasSessions";
import type { AtlasWorld } from "../atlas-world/AtlasWorld";
import type { IAtlasMission } from "./IAtlasMission";

/**
 * Everything a route needs, handed in rather than reached for.
 *
 * Reached for would mean module state, and module state on a server is one world
 * shared by every test in the file — after which the order the tests ran in
 * starts deciding the result.
 */
export interface IAtlasApi {
	world: AtlasWorld;
	sessions: AtlasSessions;
	/** What a POST already did under a key, so a retry does not do it twice. */
	created: AtlasIdempotency<IAtlasMission>;
}
