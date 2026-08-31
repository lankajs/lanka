/**
 * Everything the todo screen can DO.
 *
 * Declared apart from the state so a screen's props can name one without the
 * other, and so an action added here is a compile error until it is written.
 */
export interface IPlaygroundTodoActions {
	load: () => Promise<void>;
	loadOne: (id: number) => Promise<void>;
	complete: (id: number) => void;
}
