import type { ILankaTransport } from "lanka/gateway";
import type { ILankaScenario } from "lanka/scenario";

/**
 * Test double factories.
 *
 * ## Why they live in the kit rather than in each consumer
 *
 * A transport double is twenty lines everyone writes again and slightly
 * differently: one returns a `Response`, another already-parsed JSON, a third
 * forgets headers. They diverge silently, and the cost is paid by a test that
 * "somehow does not catch" what its neighbour catches.
 *
 * ## What is not here
 *
 * A ViewModel double. There is nothing to substitute: the ViewModel is the
 * subject under test, and everything it needs from outside — gateways and
 * services — is passed as parameters.
 */

export interface ILankaFakeTransport extends ILankaTransport<RequestInit> {
	/** What the transport was called with — one entry per request. */
	readonly calls: readonly { endpoint: string; options: RequestInit | undefined }[];
}

export interface ILankaFakeTransportConfig {
	/** Body of a successful response. Defaults to `{}`. */
	body?: unknown;
	/** Response status. Defaults to 200. */
	status?: number;
	/** A failure instead of a response: the transport throws this. */
	failWith?: () => Error;
}

/** A transport that records calls and answers what it was told to. */
export const createLankaFakeTransport = (
	config: ILankaFakeTransportConfig = {},
): ILankaFakeTransport => {
	const calls: { endpoint: string; options: RequestInit | undefined }[] = [];

	return {
		calls,
		request: (endpoint: string, options?: RequestInit) => {
			calls.push({ endpoint, options });
			if (config.failWith) return Promise.reject(config.failWith());

			return Promise.resolve(
				new Response(JSON.stringify(config.body ?? {}), {
					status: config.status ?? 200,
					headers: { "content-type": "application/json" },
				}),
			);
		},
	};
};

/**
 * A scenario double: counts subscriptions and can be fired by hand.
 *
 * Returns a REAL unsubscribe function rather than a stub: otherwise a test
 * checking that a ViewModel unsubscribes would only prove it called a function
 * that does nothing.
 */
export interface ILankaFakeScenario<TData> extends ILankaScenario<TData> {
	/** How many subscribers there are now. */
	readonly subscriberCount: () => number;
	/** Fire an event at every subscriber. */
	readonly emit: (data: TData) => void;
}

export const createLankaFakeScenario = <TData>(
	eventType = "fake.scenario",
): ILankaFakeScenario<TData> => {
	const handlers = new Set<(data?: TData) => void>();

	return {
		name: eventType,
		eventType,
		dataTypeName: "FakeScenarioData",
		subscriberCount: () => handlers.size,
		emit: (data: TData) => {
			for (const handler of [...handlers]) handler(data);
		},
		subscribe: (handler: (data?: TData) => void) => {
			handlers.add(handler);
			return () => {
				handlers.delete(handler);
			};
		},
		trigger: (data?: TData) => {
			for (const handler of [...handlers]) handler(data);
		},
	};
};
