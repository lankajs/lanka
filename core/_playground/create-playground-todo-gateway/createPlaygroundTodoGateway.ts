import { createLankaFetchJsonRequest, createLankaGateway } from "../../src/gateway/index";
import type { ILankaTransport } from "../../src/gateway/index";
import type { IPlaygroundTodo } from "../_interfaces/IPlaygroundTodo";

/**
 * The same gateway as `PlaygroundTodoGateway`, written by calling.
 *
 * Side by side with the class on purpose: the endpoints, the base path and the
 * request are identical, and the scene asserts that what they answer is too.
 * That assertion is what stands between "both styles" and two implementations
 * that agreed on the day they were written.
 */
export const createPlaygroundTodoGateway = (transport: ILankaTransport<RequestInit>) =>
	createLankaGateway({
		request: createLankaFetchJsonRequest({ transport }),
		basePath: "/todos",
		methods: ({ endpoint, request, buildQueryParams }) => ({
			list: () => request<IPlaygroundTodo[]>(endpoint()),

			byId: (id: number) => request<IPlaygroundTodo>(endpoint(String(id))),

			search: (term: string) =>
				request<IPlaygroundTodo[]>(
					endpoint(`?${buildQueryParams({ q: term, tags: ["open"] }).toString()}`),
				),
		}),
	});
