import { answerInLegacyShape } from "../answer-in-legacy-shape/answerInLegacyShape";
import type { ILankaTransport } from "../../src/gateway/index";
import type { IPlaygroundTodo } from "../_interfaces/IPlaygroundTodo";

/** A transport that answers from memory, and remembers what it was asked. */
export interface IPlaygroundTransport extends ILankaTransport<RequestInit> {
	calls: string[];
	/** The options each call carried, so a scene can see what a request SENT. */
	sent: (RequestInit | undefined)[];
}

/**
 * The ONLY thing standing in for the outside world.
 *
 * Everything above it — request, gateway, ViewModel, scenario, screen — is the
 * framework's own code running for real. A playground that stubs the layer under
 * test proves only that the stub works, so the seam is placed at the network and
 * nowhere else.
 */
export const createPlaygroundTransport = (todos: IPlaygroundTodo[]): IPlaygroundTransport => {
	const calls: string[] = [];
	const sent: (RequestInit | undefined)[] = [];

	return {
		calls,
		sent,
		request(endpoint: string, options?: RequestInit) {
			calls.push(endpoint);
			sent.push(options);

			if (endpoint.includes("shape=legacy")) return answerInLegacyShape(todos);

			const id = Number(endpoint.split("/").at(-1));
			const body = Number.isNaN(id) ? todos : (todos.find((todo) => todo.id === id) ?? null);

			if (body === null) {
				return Promise.resolve(
					new Response(JSON.stringify({ message: "no such todo" }), { status: 404 }),
				);
			}

			return Promise.resolve(
				new Response(JSON.stringify(body), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
			);
		},
	};
};
