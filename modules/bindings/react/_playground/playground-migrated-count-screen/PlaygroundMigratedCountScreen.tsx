import { usePlaygroundTodosVM } from "../use-playground-todos-vm/usePlaygroundTodosVM";

/** What the screen needs, which on 1.x was nothing: the hook is imported. */
export interface IPlaygroundMigratedCountScreenProps {
	onRender?: () => void;
}

/**
 * The other 1.x call shape: the hook given a selector.
 *
 * Its own screen rather than a second read inside the one above, because the two
 * take different paths through `useLankaVM` — a selector bypasses access
 * tracking and holds its selection — and a component doing both would never show
 * which of them answered.
 */
export const PlaygroundMigratedCountScreen = ({
	onRender,
}: IPlaygroundMigratedCountScreenProps) => {
	const count = usePlaygroundTodosVM((state) => state.todos.length);
	onRender?.();

	return <p data-testid="count">{count}</p>;
};
