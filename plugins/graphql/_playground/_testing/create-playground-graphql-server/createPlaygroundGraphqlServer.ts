import type { ILankaTransport } from "lanka/gateway";

/** One scripted answer: the body, and the status it comes with. */
export interface IPlaygroundGraphqlAnswer {
	body: unknown;
	status?: number;
	/** Sent as text rather than JSON, for the misrouted-endpoint case. */
	text?: string;
}

/** What a test can ask the server afterwards. */
export interface IPlaygroundGraphqlServer {
	transport: ILankaTransport<RequestInit>;
	/** Every request body the application sent, parsed. */
	sent: () => { query: string; variables?: Record<string, unknown> }[];
	/** The headers of the last request. */
	lastHeaders: () => Record<string, string>;
}

/**
 * The GraphQL endpoint, as far as this application can tell.
 *
 * The transport IS the outside world for the operations half of the package, so
 * it is the one thing stubbed. Everything above it — the body, the headers, the
 * `errors` reading, the failure kinds — is the package's own code running for
 * real.
 */
export const createPlaygroundGraphqlServer = (
	answers: readonly IPlaygroundGraphqlAnswer[],
): IPlaygroundGraphqlServer => {
	const requests: RequestInit[] = [];
	let turn = 0;

	return {
		transport: {
			request: (_resource: RequestInfo, options?: RequestInit) => {
				requests.push(options ?? {});
				const answer = answers[Math.min(turn, answers.length - 1)];
				turn += 1;

				return Promise.resolve(
					new Response(answer.text ?? JSON.stringify(answer.body), {
						status: answer.status ?? 200,
						headers: { "content-type": "application/json" },
					}),
				);
			},
		},
		sent: () =>
			requests.map(
				(request) =>
					JSON.parse(request.body as string) as {
						query: string;
						variables?: Record<string, unknown>;
					},
			),
		lastHeaders: () => (requests.at(-1)?.headers ?? {}) as Record<string, string>,
	};
};
