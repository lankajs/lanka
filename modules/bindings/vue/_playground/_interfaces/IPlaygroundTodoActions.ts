/** Everything the todo screen can DO. */
export interface IPlaygroundTodoActions {
	load: () => Promise<void>;
	fail: (message: string) => void;
	complete: (id: number) => void;
	touchUnread: () => void;
}
