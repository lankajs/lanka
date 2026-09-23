import { createLanka } from "lanka/bootstrap";
import { resolveLankaVM } from "lanka/extend";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { lankaRelay } from "../../src/index";
import { playgroundCart } from "../playground-cart/playgroundCart";
import type { TPlaygroundCartVM } from "../playground-cart/playgroundCart";
import { playgroundCartChanged } from "../playground-cart-changed/playgroundCartChanged";
import type { IPlaygroundApplication } from "../_interfaces/IPlaygroundApplication";

/**
 * The shop: it SENDS the cart's changes, and retains the last one for whoever
 * joins the page later.
 *
 * Its cart is resolved in a scope, so closing the shop's screen takes the cart
 * with it — the same call a separately built module makes when it unmounts.
 */
export const startPlaygroundShop = async (
	channel: string,
): Promise<IPlaygroundApplication<TPlaygroundCartVM>> => {
	const lanka = createLanka({ host: lankaTestHost });
	lanka.use(
		lankaRelay({
			channel,
			send: [playgroundCartChanged.eventType],
			retain: [playgroundCartChanged.eventType],
		}),
	);
	await lanka.bootstrap();

	const scope = lanka.createScope();

	return { lanka, scope, viewModel: resolveLankaVM(playgroundCart, { scope }) };
};
