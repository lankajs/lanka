import type { IPlaygroundTodo } from "../../_interfaces/IPlaygroundTodo";

/**
 * The answer a screen gets while the server does not exist yet.
 *
 * A module of its own because that is the shape the mock subsystem is built for:
 * it is imported DYNAMICALLY, so with mocks off the bundler drops this file and
 * everything it references out of the production build.
 */
export const playgroundTodoMocks: IPlaygroundTodo[] = [
	{ id: 91, title: "designed before the server existed", done: false },
	{ id: 92, title: "and it still shipped", done: true },
];
