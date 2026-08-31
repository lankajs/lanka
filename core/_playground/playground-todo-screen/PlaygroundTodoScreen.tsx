import type { IPlaygroundTodoActions } from "../_interfaces/IPlaygroundTodoActions";
import type { IPlaygroundTodosState } from "../_interfaces/IPlaygroundTodosState";

/** What the screen needs: a hook to read, and a way to observe its renders. */
export interface IPlaygroundTodoScreenProps {
	useTodosVM: () => IPlaygroundTodosState & IPlaygroundTodoActions;
	onRender?: () => void;
}

/**
 * The screen. Reads state, calls actions, and decides nothing.
 *
 * Written in JSX rather than `createElement` because that is what a consumer
 * writes: a playground that avoids the consumer's syntax stops proving the
 * consumer's build works.
 */
export const PlaygroundTodoScreen = ({ useTodosVM, onRender }: IPlaygroundTodoScreenProps) => {
	const { todos, error, isLoading } = useTodosVM();
	onRender?.();

	if (error !== null) return <p role="alert">{error}</p>;
	if (isLoading) return <p>loading</p>;

	return (
		<ul>
			{todos.map((todo) => (
				<li key={todo.id}>{todo.done ? `${todo.title} ✓` : todo.title}</li>
			))}
		</ul>
	);
};
