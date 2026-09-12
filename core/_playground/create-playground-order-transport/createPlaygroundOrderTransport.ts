import { routePlaygroundOrderRequest } from "../route-playground-order-request/routePlaygroundOrderRequest";
import type { ILankaTransport } from "../../src/gateway/index";
import type { IPlaygroundOrder } from "../_interfaces/IPlaygroundOrder";

/** An order server that lives in memory, and remembers what it was asked. */
export interface IPlaygroundOrderTransport extends ILankaTransport<RequestInit> {
	/** `GET /orders/1`, `PUT /orders/1`, in order. */
	calls: string[];
	/** The server's memory. A scene edits it to play "somebody else saved". */
	orders: IPlaygroundOrder[];
	/** Units available per SKU; a line asking for more is refused. */
	stock: Record<string, number>;
	/** The next request never reaches the server. */
	failNext: (failure: "network" | null) => void;
}

/**
 * The ONLY stand-in for the outside world in the order scenes.
 *
 * Everything above it — request, gateway, ViewModel, cache, scenario, form seam
 * — is real code running for real. The seam sits at the network so that a 422
 * arrives the way a server sends one: a status and a JSON body, read once by the
 * error handler, carried on the error, read into `fields` by the gateway.
 *
 * What it owns is the WIRE: what was asked, and what failed before reaching
 * anyone. The routes are `routePlaygroundOrderRequest`.
 */
export const createPlaygroundOrderTransport = (
	orders: IPlaygroundOrder[],
	stock: Record<string, number> = {},
): IPlaygroundOrderTransport => {
	const calls: string[] = [];
	let failing: "network" | null = null;

	return {
		calls,
		orders,
		stock,
		failNext: (failure) => {
			failing = failure;
		},
		request(endpoint: string, options?: RequestInit) {
			calls.push(`${options?.method ?? "GET"} ${endpoint}`);

			// A cancelled request fails the way `fetch` fails it, so the request
			// layer names it `aborted` and nobody shows it.
			if (options?.signal?.aborted) {
				return Promise.reject(
					new DOMException("The user aborted a request.", "AbortError"),
				);
			}
			if (failing === "network") {
				failing = null;
				return Promise.reject(new TypeError("Failed to fetch"));
			}

			return routePlaygroundOrderRequest(orders, stock, endpoint, options);
		},
	};
};
