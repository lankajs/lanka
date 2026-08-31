import { lankaLogger } from "lanka/logger";
import { playgroundCartChanged } from "../playground-cart-changed/PlaygroundCartChanged";
import type { ILankaInstance } from "lanka";

/**
 * Everything the inspector is supposed to notice, done once.
 *
 * All three sources appear together because the inspector is the only thing that
 * sees all three, and because an enabled and a disabled inspector must be given
 * exactly the same activity for "a disabled one accumulates nothing" to mean
 * anything.
 */
export const useTheApp = (lanka: ILankaInstance): void => {
	playgroundCartChanged.trigger({ items: 1 });
	playgroundCartChanged.trigger({ items: 2 });

	lankaLogger.printViewModelLog("cart updated", "PlaygroundCartVM");

	// A request leaving and arriving: the counter is what the inspector reads.
	lanka.inFlight.begin();
	lanka.inFlight.end();
};
