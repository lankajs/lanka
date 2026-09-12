import { routePlaygroundRequest } from "../route-playground-request/routePlaygroundRequest";
import type { ILankaTransport } from "lanka/gateway";
import type { IPlaygroundOrder } from "../../_interfaces/IPlaygroundOrder";

/** An order server in memory, which remembers what it was asked. */
export interface IPlaygroundTransport extends ILankaTransport<RequestInit> {
	/** `GET /orders`, `PUT /orders/1`, in order. */
	calls: string[];
	orders: IPlaygroundOrder[];
}

/**
 * The ONLY stand-in for the outside world.
 *
 * Everything above it — request, gateway, cache, ViewModel — is real code
 * running for real. The seam is the network, which is what makes "two screens,
 * one request" a measurement rather than a claim: the count is taken here.
 */
export const createPlaygroundTransport = (orders: IPlaygroundOrder[]): IPlaygroundTransport => {
	const calls: string[] = [];

	return {
		calls,
		orders,
		request(endpoint: string, options?: RequestInit) {
			calls.push(`${options?.method ?? "GET"} ${endpoint}`);

			return Promise.resolve(routePlaygroundRequest(orders, endpoint, options));
		},
	};
};
