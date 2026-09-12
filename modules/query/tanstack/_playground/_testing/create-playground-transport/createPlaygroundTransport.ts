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
			const method = options?.method ?? "GET";
			calls.push(`${method} ${endpoint}`);

			const id = Number(endpoint.split("/").at(-1));
			const index = orders.findIndex((order) => order.id === id);

			if (method === "PUT" && index !== -1) {
				const raw = typeof options?.body === "string" ? options.body : "{}";
				const customer = String((JSON.parse(raw) as { customer?: unknown }).customer);
				if (customer === "taken") {
					return Promise.resolve(
						new Response(JSON.stringify({ message: "that name is already used" }), {
							status: 409,
							headers: { "content-type": "application/json" },
						}),
					);
				}

				orders[index] = {
					...orders[index],
					customer,
					updatedAt: orders[index].updatedAt + 1,
				};
			}

			const body = Number.isNaN(id) ? orders : (orders[index] ?? null);

			return Promise.resolve(
				new Response(JSON.stringify(body), {
					status: body === null ? 404 : 200,
					headers: { "content-type": "application/json" },
				}),
			);
		},
	};
};
