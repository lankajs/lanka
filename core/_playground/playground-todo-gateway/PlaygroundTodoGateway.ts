import { ALankaGateway } from "../../src/gateway/index";
import { buildLankaQueryParams } from "../../src/gateway/index";
import { createLankaApiError } from "../../src/errors/index";
import { createLankaMockHandler } from "../../src/mock/index";
import { LankaFetchJsonRequest } from "../../src/gateway/index";
import { lankaStandardValidator } from "../../src/validation/index";
import { playgroundTodoApiSchema } from "../playground-todo-api-schema/playgroundTodoApiSchema";
import { playgroundTodoSchema } from "../playground-todo-schema/playgroundTodoSchema";
import type { ILankaTransport } from "../../src/gateway/index";
import type { IPlaygroundTodo } from "../_interfaces/IPlaygroundTodo";

/**
 * Everything this application asks of a server, in one place.
 *
 * A gateway states the endpoints and nothing else: no state, no error handling,
 * no decisions about what a failure means. Those belong to the ViewModel that
 * calls it, which is why this file is short and stays short.
 */
export class PlaygroundTodoGateway extends ALankaGateway<RequestInit> {
	constructor(transport: ILankaTransport<RequestInit>) {
		super({ request: new LankaFetchJsonRequest({ transport }), basePath: "/todos" });
	}

	/**
	 * The list — from the server, or from a module while there is no server.
	 *
	 * The mock handler is `undefined` with mocks off, so the branch disappears
	 * and the dynamic import is never reached: a production bundle contains no
	 * mock data because nothing in it can refer to the module.
	 */
	list(): Promise<IPlaygroundTodo[]> {
		const mock = createLankaMockHandler(
			() => import("../_testing/playground-todo-mocks/playgroundTodoMocks"),
			(module) => module.playgroundTodoMocks,
			"todos.list",
			0,
		);
		if (mock) return mock();

		return this.requestExecutor.execute<IPlaygroundTodo[]>(this.endpoint());
	}

	byId(id: number): Promise<IPlaygroundTodo> {
		return this.requestExecutor.execute<IPlaygroundTodo>(this.endpoint(String(id)));
	}

	/**
	 * A search, refused locally when it cannot succeed.
	 *
	 * The refusal is built with the framework's own error factory rather than a
	 * bare `throw`: a screen then has ONE failure shape to render, whether the no
	 * came from here or from the server.
	 */
	search(term: string): Promise<IPlaygroundTodo[]> {
		if (term.trim().length === 0) {
			return Promise.reject(createLankaApiError(400, ["a search needs a term"]));
		}

		const query = buildLankaQueryParams({ q: term, tags: ["open"] });
		return this.requestExecutor.execute<IPlaygroundTodo[]>(
			this.endpoint(`?${query.toString()}`),
		);
	}

	/**
	 * The list from a server that speaks a different shape.
	 *
	 * TWO steps, and they are two different jobs. The first maps the wire into
	 * the application's vocabulary and changes when the SERVER changes; the
	 * second states what the application requires and changes when the
	 * APPLICATION does. There is no adapter layer between them because there is
	 * nothing for it to do: Standard Schema's validate returns the transformed
	 * value, so a mapping is a schema like any other.
	 */
	async listFromLegacyApi(): Promise<IPlaygroundTodo[]> {
		const wire = await this.requestExecutor.execute<unknown>(this.endpoint("?shape=legacy"));

		const domain = lankaStandardValidator.validate(
			playgroundTodoApiSchema,
			wire,
			"todos.legacy.map",
		);

		return lankaStandardValidator.validate(playgroundTodoSchema, domain, "todos.legacy.check");
	}

	/**
	 * The list, checked against a schema before anyone reads it.
	 *
	 * A gateway is where a body stops being `unknown`. Validating in the screen
	 * instead spreads the same three guards over every consumer, and each one
	 * gets it slightly differently wrong.
	 */
	async listValidated(): Promise<IPlaygroundTodo[]> {
		const body = await this.requestExecutor.execute<unknown>(this.endpoint());
		return lankaStandardValidator.validate(playgroundTodoSchema, body, "todos.list");
	}
}
