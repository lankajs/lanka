import { useLankaVM } from "../../src/index";
import type { ILankaFakeVMActions, ILankaFakeVMState } from "@lankajs/tool-testing";
import type { ILankaReadableVM } from "lanka/viewmodel";

/** What the screen needs: a ViewModel to read, and a way to observe its renders. */
export interface IPlaygroundTodoScreenProps {
	todosVM: ILankaReadableVM<ILankaFakeVMState & ILankaFakeVMActions>;
	onRender?: () => void;
}

/**
 * The screen. Reads state, calls actions, and decides nothing.
 *
 * It takes the ViewModel and reaches for it through `useLankaVM` ITSELF rather
 * than being handed a hook — which is what a consumer writes, and what makes the
 * same ViewModel readable from a Vue or Svelte screen without changing.
 *
 * Written in JSX rather than `createElement` because that is what a consumer
 * writes: a playground that avoids the consumer's syntax stops proving the
 * consumer's build works.
 */
export const PlaygroundTodoScreen = ({ todosVM, onRender }: IPlaygroundTodoScreenProps) => {
	const { rows, error, isLoading } = useLankaVM(todosVM);
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
