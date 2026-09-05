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

/** Which requests a route answers. */
export type TLankaFakeTransportMatch =
	string | RegExp | ((endpoint: string, options: RequestInit | undefined) => boolean);

/**
 * One endpoint's answer.
 *
 * A screen reads more than one endpoint, and a double that answers all of them
 * the same way cannot test it — so the consumer writes the twenty lines this kit
 * exists to prevent. The first matching route answers; nothing matching falls
 * through to the config's own `body` / `status` / `failWith`.
 */
export interface ILankaFakeTransportRoute {
	/** A substring of the endpoint, a pattern over it, or a predicate. */
	match: TLankaFakeTransportMatch;
	/** Body of a successful response. Defaults to `{}`. */
	body?: unknown;
	/** Response status. Defaults to 200. */
	status?: number;
	/** A failure instead of a response: the transport throws this. */
	failWith?: () => Error;
	/**
	 * Answer this way at most N times, then fall through to the next match.
	 *
	 * What "retried once and then succeeded" is written with.
	 */
	times?: number;
	/**
	 * Answer only after this long — for asserting a loading state.
	 *
	 * A real timer. Under `vi.useFakeTimers()` the test advances them itself.
	 */
	delayMs?: number;
}

export interface ILankaFakeTransport extends ILankaTransport<RequestInit> {
	/** What the transport was called with — one entry per request. */
	readonly calls: readonly { endpoint: string; options: RequestInit | undefined }[];
	/** The calls whose endpoint matches, in order. */
	readonly callsTo: (
		match: TLankaFakeTransportMatch,
	) => readonly { endpoint: string; options: RequestInit | undefined }[];
}

export interface ILankaFakeTransportConfig {
	/** Body of a successful response. Defaults to `{}`. */
	body?: unknown;
	/** Response status. Defaults to 200. */
	status?: number;
	/** A failure instead of a response: the transport throws this. */
	failWith?: () => Error;
	/** Per-endpoint answers, tried in order before the three fields above. */
	routes?: readonly ILankaFakeTransportRoute[];
}

/** A transport that records calls and answers what it was told to. */
export const createLankaFakeTransport = (
	config: ILankaFakeTransportConfig = {},
): ILankaFakeTransport => {
	const calls: { endpoint: string; options: RequestInit | undefined }[] = [];
	const spent = new Map<ILankaFakeTransportRoute, number>();

	const routeFor = (
		endpoint: string,
		options: RequestInit | undefined,
	): ILankaFakeTransportRoute | undefined =>
		config.routes?.find((route) => {
			if (!matchesEndpoint(route.match, endpoint, options)) return false;
			// An exhausted route stops matching rather than answering forever: that
			// is what makes "failed once, then succeeded" expressible.
			const used = spent.get(route) ?? 0;
			if (route.times !== undefined && used >= route.times) return false;

			spent.set(route, used + 1);
			return true;
		});

	return {
		calls,
		callsTo: (match) =>
			calls.filter((call) => matchesEndpoint(match, call.endpoint, call.options)),
		request: (endpoint: string, options?: RequestInit) => {
			calls.push({ endpoint, options });

			return answerWith(routeFor(endpoint, options) ?? config);
		},
	};
};

/** Whether one matcher accepts this call. */
const matchesEndpoint = (
	match: TLankaFakeTransportMatch,
	endpoint: string,
	options: RequestInit | undefined,
): boolean => {
	if (typeof match === "string") return endpoint.includes(match);
	if (match instanceof RegExp) return match.test(endpoint);

	return match(endpoint, options);
};

/** The one answer shape, so a route and the fallback cannot drift apart. */
const answerWith = (
	answer: ILankaFakeTransportRoute | ILankaFakeTransportConfig,
): Promise<Response> => {
	const delayMs = "delayMs" in answer ? answer.delayMs : undefined;
	const settle = (): Promise<Response> => {
		if (answer.failWith) return Promise.reject(answer.failWith());

		return Promise.resolve(
			new Response(JSON.stringify(answer.body ?? {}), {
				status: answer.status ?? 200,
				headers: { "content-type": "application/json" },
			}),
		);
	};

	if (delayMs === undefined) return settle();

	return new Promise<Response>((resolve, reject) => {
		setTimeout(() => {
			settle().then(resolve, reject);
		}, delayMs);
	});
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
	/**
	 * Every payload this double carried, in order.
	 *
	 * A ViewModel that publishes is asserted on WHAT it published; without this
	 * the test wraps `emit` by hand and asserts its own wrapper.
	 */
	readonly emitted: readonly TData[];
}

export const createLankaFakeScenario = <TData>(
	eventType = "fake.scenario",
): ILankaFakeScenario<TData> => {
	const handlers = new Set<(data?: TData) => void>();
	const emitted: TData[] = [];

	const fire = (data?: TData): void => {
		if (data !== undefined) emitted.push(data);
		for (const handler of [...handlers]) handler(data);
	};

	return {
		name: eventType,
		eventType,
		dataTypeName: "FakeScenarioData",
		emitted,
		subscriberCount: () => handlers.size,
		emit: (data: TData) => {
			fire(data);
		},
		subscribe: (handler: (data?: TData) => void) => {
			handlers.add(handler);
			return () => {
				handlers.delete(handler);
			};
		},
		trigger: (data?: TData) => {
			fire(data);
		},
	};
};
