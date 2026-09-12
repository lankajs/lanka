import type { ILankaTransport } from "lanka/gateway";
import type { IPlaygroundArticle } from "../../_interfaces/IPlaygroundArticle";

/** An article server in memory, which remembers what it was asked. */
export interface IPlaygroundTransport extends ILankaTransport<RequestInit> {
	calls: string[];
	articles: IPlaygroundArticle[];
}

/**
 * The ONLY stand-in for the outside world.
 *
 * Everything above it runs for real, so "one request for two screens" is counted
 * here rather than asserted about a mock.
 */
export const createPlaygroundTransport = (articles: IPlaygroundArticle[]): IPlaygroundTransport => {
	const calls: string[] = [];

	return {
		calls,
		articles,
		request(endpoint: string, options?: RequestInit) {
			calls.push(`${options?.method ?? "GET"} ${endpoint}`);

			const slug = endpoint.split("/").at(-1);
			const found = articles.find((article) => article.slug === slug);

			return Promise.resolve(
				new Response(JSON.stringify(found ?? null), {
					status: found ? 200 : 404,
					headers: { "content-type": "application/json" },
				}),
			);
		},
	};
};
