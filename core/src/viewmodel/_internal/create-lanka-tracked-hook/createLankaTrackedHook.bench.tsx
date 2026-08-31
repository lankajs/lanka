import { bench, describe } from "vitest";
import { cleanup, render } from "@testing-library/react";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { createLankaTrackedHook } from "./createLankaTrackedHook";

/**
 * The framework's hottest path: what one render pays to be tracked.
 *
 * Every screen reads its state through a proxy that records which keys were
 * touched, so the next change can skip a re-render nobody would see. The
 * recording happens on every property access of every render, which multiplies
 * it by the size of the application in a way nothing else here does.
 *
 * React is inside the number and cannot be taken out — the hook is a hook. So
 * the control below renders the SAME component reading a plain object: the
 * difference between the two is the framework's share, and it is the only part
 * anybody here can change.
 */
interface IState {
	todos: number[];
	isLoading: boolean;
	error: string | null;
	page: number;
}

describe("createLankaTrackedHook", () => {
	lankaBenchCalibration();

	const state: IState = { todos: [1, 2, 3], isLoading: false, error: null, page: 1 };
	type TListener = (next: IState, prev: IState) => void;
	const listeners = new Set<TListener>();

	const useTracked = createLankaTrackedHook<IState>({
		subscribe: (onChange) => {
			listeners.add(onChange);
			return () => {
				listeners.delete(onChange);
			};
		},
		readState: () => state,
	});

	const Tracked = (): React.JSX.Element => {
		const read = useTracked() as IState;

		return (
			<span>
				{read.todos.length}
				{String(read.isLoading)}
				{read.error ?? ""}
				{read.page}
			</span>
		);
	};

	const Plain = (): React.JSX.Element => (
		<span>
			{state.todos.length}
			{String(state.isLoading)}
			{state.error ?? ""}
			{state.page}
		</span>
	);

	bench(
		"a screen reading four keys through the tracked hook",
		() => {
			render(<Tracked />);
			cleanup();
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"the same screen reading a plain object",
		() => {
			render(<Plain />);
			cleanup();
		},
		LANKA_BENCH_OPTIONS,
	);
});
