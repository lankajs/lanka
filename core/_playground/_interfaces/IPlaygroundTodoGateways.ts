import type { PlaygroundTodoGateway } from "../playground-todo-gateway/PlaygroundTodoGateway";

/**
 * The data layer this ViewModel is given, named rather than inlined.
 *
 * A ViewModel receives its gateways; it never constructs one. That is what makes
 * the whole application startable against a transport that never leaves the
 * process.
 */
export interface IPlaygroundTodoGateways {
	todoGateway: PlaygroundTodoGateway;
}
