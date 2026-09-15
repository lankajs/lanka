import type { TLankaReactVM } from "../../src/index";
import type { ILankaFakeVMActions, ILankaFakeVMState } from "@lankajs/tool-testing";
import type { ILankaReadableVM } from "lanka/viewmodel";

/** What the screen needs: a ViewModel that is also a hook. */
export interface IPlaygroundCallableTodoScreenProps {
	useTodosVM: TLankaReactVM<ILankaReadableVM<ILankaFakeVMState & ILankaFakeVMActions>>;
	onRender?: () => void;
}

/**
 * The same screen as `PlaygroundTodoScreen`, in the spelling React had before
 * the port existed.
 *
 * It is here because the two must stay the same screen. `useLankaVM(todosVM)`
 * next door and `useTodosVM()` here read one store, through one subscription,
 * with one set of tracked keys — and a scene that only exercised the portable
 * spelling would let the callable one drift without anything noticing.
 *
 * A consumer arriving from 1.x writes this file. The ViewModel it is handed was
 * built by `createLankaVM` with no framework in sight and wrapped once, which is
 * the whole of what the migration asks for.
 */
export const PlaygroundCallableTodoScreen = ({
	useTodosVM,
	onRender,
}: IPlaygroundCallableTodoScreenProps) => {
	const { rows, error, isLoading } = useTodosVM();
	onRender?.();

	if (error !== null) return <p role="alert">{error}</p>;
	if (isLoading) return <p>loading</p>;

	return (
		<ul>
			{rows.map((row) => (
				<li key={row}>{row}</li>
			))}
		</ul>
	);
};
