import { PlaygroundTodoList } from "../playground-todo-list/PlaygroundTodoList";
import { usePlaygroundDeclaredTodosVM } from "../use-playground-declared-todos-vm/usePlaygroundDeclaredTodosVM";

/**
 * The screen a consumer writes over a one-line declaration.
 *
 * It takes no props and imports nothing but the ViewModel, because that is the
 * shape the pre-applied read buys: the declaration is a module, the screen calls
 * it, and there is no provider, no wrapper and no `useLankaVM(todosVM)` in
 * between. Its sibling `PlaygroundTodoScreen` keeps the portable spelling, which
 * is what a screen moving between frameworks is written in.
 */
export const PlaygroundDeclaredTodoScreen = () => {
	const { heading, titles } = usePlaygroundDeclaredTodosVM();

	return <PlaygroundTodoList heading={heading} titles={titles} />;
};
