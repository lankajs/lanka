import type { IncomingMessage, ServerResponse } from "node:http";

/** What a handler is given: the request, its path parameters and its body. */
export interface IAtlasCall {
	request: IncomingMessage;
	response: ServerResponse;
	/** Everything the path pattern captured, by name. */
	params: Readonly<Record<string, string>>;
	/** The query string, already parsed. */
	query: URLSearchParams;
	/** The parsed JSON body, or `null` for a request that carried none. */
	body: unknown;
}

/**
 * One route: a method, a pattern, and what answers it.
 *
 * A table rather than a chain of `if`s, so the routes of one subject sit
 * together where they can be compared, and adding one is an entry rather than an
 * edit inside a function.
 */
export interface IAtlasRoute {
	method: "GET" | "POST" | "PATCH" | "DELETE";
	/** `/missions/:id` — a `:name` segment captures into `params`. */
	path: string;
	run: (call: IAtlasCall) => void | Promise<void>;
}
