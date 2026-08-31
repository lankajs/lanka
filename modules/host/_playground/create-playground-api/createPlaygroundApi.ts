import type { IPlaygroundApi } from "../_interfaces/IPlaygroundApi";
import type { IPlaygroundPost } from "../_interfaces/IPlaygroundPost";

/**
 * A server that never leaves the process, and remembers who asked.
 *
 * It records headers because half of what the server side is FOR is arriving at
 * the API as the right person: a scene that only checked the payload would pass
 * while every server-rendered page fetched as a stranger.
 */
export const createPlaygroundApi = (posts: readonly IPlaygroundPost[]): IPlaygroundApi => {
	const seen: (Record<string, unknown> | undefined)[] = [];

	const api: IPlaygroundApi = {
		seen,
		calls: () => seen.length,
		transport: {
			request: (_resource: RequestInfo, options?: RequestInit) => {
				seen.push(options?.headers as Record<string, unknown> | undefined);

				if (api.failWith !== undefined) {
					// A status, not a thrown error: this is what a server refusing looks
					// like, and the framework's job is to tag it `http` rather than
					// `network`. A stub that threw would test the wrong branch.
					return Promise.resolve(
						new Response(JSON.stringify({ message: "no" }), {
							status: api.failWith,
							headers: { "content-type": "application/json" },
						}),
					);
				}

				return Promise.resolve(
					new Response(JSON.stringify(posts), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
				);
			},
		},
	};

	return api;
};
