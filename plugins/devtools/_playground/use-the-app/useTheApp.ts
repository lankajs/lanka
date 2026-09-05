import { lankaLogger } from "lanka/logger";
import { playgroundCartChanged } from "../playground-cart-changed/PlaygroundCartChanged";
import type { IPlaygroundInspected } from "../_interfaces/IPlaygroundInspected";

/**
 * Everything the inspector is supposed to notice, done once.
 *
 * All four sources appear together because the inspector is the only thing that
 * sees all four at once, and because an enabled and a disabled inspector must be
 * given exactly the same activity for "a disabled one accumulates nothing" to
 * mean anything.
 */
export const useTheApp = async (app: IPlaygroundInspected): Promise<void> => {
	playgroundCartChanged.trigger({ items: 1 });
	playgroundCartChanged.trigger({ items: 2 });

	lankaLogger.printViewModelLog("cart updated", "PlaygroundCartVM");

	// A real request, through the middleware point the inspector wraps: what it
	// costs and whether it arrived are the two things a counter could never say.
	await app.cartGateway.load();
};
