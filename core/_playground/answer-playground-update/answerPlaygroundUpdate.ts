import type { IPlaygroundOrder } from "../_interfaces/IPlaygroundOrder";
import type { IPlaygroundOrderInput } from "../_interfaces/IPlaygroundOrderInput";

/** What the stubbed server does with a `PUT /orders/:id`. */
export interface IPlaygroundServerAnswer {
	status: number;
	body: unknown;
}

/**
 * The server's side of a save, in memory.
 *
 * Three refusals a real backend has, each in the shape it would come: a stale
 * `updatedAt` is a 409 with a sentence; a line asking for more than is in stock,
 * or a customer name already taken, is a 422 whose `errors` map addresses to
 * messages — the shape Nest, Laravel and Rails produce, and the one the
 * application's gateway reads into `fields`.
 */
export const answerPlaygroundUpdate = (
	orders: IPlaygroundOrder[],
	index: number,
	payload: IPlaygroundOrderInput & { updatedAt?: number },
	stock: Record<string, number>,
): IPlaygroundServerAnswer => {
	const current = orders[index];

	if (payload.updatedAt !== undefined && payload.updatedAt !== current.updatedAt) {
		return { status: 409, body: { message: "someone saved this order first" } };
	}

	// Two shapes on purpose, as real backends mix them: a bare message, and a
	// message with the reason named — what an application translates by.
	const errors: Record<string, (string | { message: string; code: string })[]> = {};
	if (payload.customer === "duplicate") errors.customer = ["that name is already used"];
	payload.items.forEach((item, line) => {
		const available = stock[item.sku];
		if (available !== undefined && item.qty > available) {
			errors[`items.${String(line)}.qty`] = [
				{ message: `only ${String(available)} left`, code: "STOCK" },
			];
		}
	});
	if (Object.keys(errors).length > 0) {
		return { status: 422, body: { message: "unprocessable", errors } };
	}

	const saved: IPlaygroundOrder = {
		id: current.id,
		customer: payload.customer,
		items: payload.items,
		updatedAt: current.updatedAt + 1,
	};
	orders[index] = saved;

	return { status: 200, body: saved };
};
