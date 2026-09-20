import { PlaygroundTodoList } from "../playground-todo-list/PlaygroundTodoList";
import { usePlaygroundClassTodosVM } from "../use-playground-class-todos-vm/usePlaygroundClassTodosVM";

/**
 * The screen a consumer writes over a CLASS, and it is the declared screen
 * character for character.
 *
 * Which is the point: what the class style costs is one wrapper in the
 * declaration file, and nothing at all here. The screen takes no props, imports
 * nothing but the ViewModel, and cannot tell whether a factory or a class was on
 * the other side of it.
 */
export const PlaygroundClassTodoScreen = () => {
	const { heading, titles } = usePlaygroundClassTodosVM();

	return <PlaygroundTodoList heading={heading} titles={titles} />;
};
