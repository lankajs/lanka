import { usePlaygroundTodosVM } from "../use-playground-todos-vm/usePlaygroundTodosVM";

/** What the screen needs, which on 1.x was nothing: the hook is imported. */
export interface IPlaygroundMigratedTodoScreenProps {
	onRender?: () => void;
}

/**
 * A 1.x screen, unedited.
 *
 * It takes no ViewModel. It imports the hook by name and calls it — the shape
 * every screen in every application on lanka had before the port existed, and
 * the shape the migration promises does not have to change. A screen handed its
 * ViewModel as a prop, as the scenes next door do it, would prove the wrapper
 * works and say nothing about whether a consumer's own file still compiles and
 * renders.
 */
export const PlaygroundMigratedTodoScreen = ({ onRender }: IPlaygroundMigratedTodoScreenProps) => {
	const { todos, error, isLoading } = usePlaygroundTodosVM();
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
