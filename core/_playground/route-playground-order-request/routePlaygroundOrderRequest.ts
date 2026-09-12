import { answerPlaygroundUpdate } from "../answer-playground-update/answerPlaygroundUpdate";
import type { IPlaygroundOrder } from "../_interfaces/IPlaygroundOrder";
import type { IPlaygroundOrderInput } from "../_interfaces/IPlaygroundOrderInput";

const json = (body: unknown, status = 200): Promise<Response> =>
	Promise.resolve(
		new Response(JSON.stringify(body), {
			status,
			headers: { "content-type": "application/json" },
		}),
	);

/**
 * The routes the order server answers, in memory.
 *
 * Its own function because the transport around it is about the WIRE — what was
 * asked, what failed before reaching anyone — and this is about the server. A
 * scene that adds a route touches this file alone.
 */
export const routePlaygroundOrderRequest = (
	orders: IPlaygroundOrder[],
	stock: Record<string, number>,
	endpoint: string,
	options?: RequestInit,
): Promise<Response> => {
	if (endpoint.includes("/customers/")) {
		const name = decodeURIComponent(endpoint.split("/customers/")[1] ?? "");
		return json({ known: orders.some((order) => order.customer === name) });
	}

	const id = Number(endpoint.split("/").at(-1));
	if (Number.isNaN(id)) return json(orders);

	const index = orders.findIndex((order) => order.id === id);
	if (index === -1) return json({ message: "no such order" }, 404);
	if ((options?.method ?? "GET") !== "PUT") return json(orders[index]);

	const raw = typeof options?.body === "string" ? options.body : "{}";
	const payload = JSON.parse(raw) as IPlaygroundOrderInput & { updatedAt?: number };
	const answer = answerPlaygroundUpdate(orders, index, payload, stock);

	return json(answer.body, answer.status);
};
