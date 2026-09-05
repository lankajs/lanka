import { ALankaGrpcGateway, createLankaGrpcJsonCodec } from "../../src/index";
import type { ILankaGrpcMethod } from "../../src/index";

/** What one row of the desk is. */
export interface IPlaygroundTodo {
	id: string;
	title: string;
	done: boolean;
}

/** What the RPCs take and answer. */
export interface IPlaygroundTodoList {
	todos: IPlaygroundTodo[];
}

const LIST: ILankaGrpcMethod<{ page: number }, IPlaygroundTodoList> = {
	path: "/playground.Todos/List",
	codec: createLankaGrpcJsonCodec<{ page: number }, IPlaygroundTodoList>(),
};

const COMPLETE: ILankaGrpcMethod<{ id: string }, IPlaygroundTodo> = {
	path: "/playground.Todos/Complete",
	codec: createLankaGrpcJsonCodec<{ id: string }, IPlaygroundTodo>(),
};

/**
 * What a consumer writes: one gateway per service.
 *
 * The class style. A method is a `path` and a `codec` declared once beside the
 * gateway, because those two are what a generated client would have given and
 * this package deliberately does not generate one.
 */
export class PlaygroundTodoGateway extends ALankaGrpcGateway {
	public list(page: number): Promise<IPlaygroundTodoList> {
		return this.unary(LIST, { page });
	}

	public complete(
		id: string,
		mockHandler?: () => Promise<IPlaygroundTodo>,
	): Promise<IPlaygroundTodo> {
		return this.unary(COMPLETE, { id }, undefined, mockHandler);
	}
}
