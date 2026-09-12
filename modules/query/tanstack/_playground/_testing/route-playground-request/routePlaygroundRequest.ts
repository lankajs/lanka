import type { IPlaygroundOrder } from "../../_interfaces/IPlaygroundOrder";

const json = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

/**
 * The routes the order server answers, in memory.
 *
 * Its own function because the transport around it is about the WIRE — what was
 * asked — and this is about the server. A scene that adds a route touches this
 * file alone.
 */
export const routePlaygroundRequest = (
	orders: IPlaygroundOrder[],
	endpoint: string,
	options?: RequestInit,
): Response => {
	const id = Number(endpoint.split("/").at(-1));
	const index = orders.findIndex((order) => order.id === id);

	if ((options?.method ?? "GET") === "PUT" && index !== -1) {
		const raw = typeof options?.body === "string" ? options.body : "{}";
		const customer = String((JSON.parse(raw) as { customer?: unknown }).customer);

		if (customer === "taken") {
			return json({ message: "that name is already used" }, 409);
		}

		orders[index] = { ...orders[index], customer, updatedAt: orders[index].updatedAt + 1 };
	}

	const body = Number.isNaN(id) ? orders : (orders[index] ?? null);

	return json(body, body === null ? 404 : 200);
};
