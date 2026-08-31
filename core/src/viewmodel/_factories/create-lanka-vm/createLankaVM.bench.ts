import { bench, describe } from "vitest";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { createLankaVM } from "./createLankaVM";

/**
 * What a screen costs to open, and what a tap costs once it is open.
 *
 * A ViewModel is built once per screen and its actions run on every interaction,
 * so the two numbers answer different questions: the first is felt as latency on
 * navigation, the second as lag under the finger. They are measured apart
 * because an optimisation almost always trades one for the other.
 */
interface IState {
	todos: number[];
	isLoading: boolean;
	error: string | null;
}

interface IActions {
	setLoading: (value: boolean) => void;
	add: (id: number) => void;
	countDone: () => number;
}

const declare = () => ({
	name: "BenchVM",
	states: { todos: [], isLoading: false, error: null } as IState,
	createActions: ({ set, get }: { set: (partial: Partial<IState>) => void; get: () => IState }) =>
		({
			setLoading: (value: boolean) => {
				set({ isLoading: value });
			},
			add: (id: number) => {
				set({ todos: [...get().todos, id] });
			},
			countDone: () => get().todos.length,
		}) satisfies IActions,
});

describe("createLankaVM", () => {
	lankaBenchCalibration();

	const useVM = createLankaVM<IState, IActions>(declare());
	let flip = false;

	bench(
		"building a ViewModel, which happens once per screen",
		() => {
			createLankaVM<IState, IActions>(declare());
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"an action writing one field",
		() => {
			flip = !flip;
			useVM.getState().setLoading(flip);
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"an action reading state through get()",
		() => {
			useVM.getState().countDone();
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"reading the whole state, which every subscriber does per change",
		() => {
			void useVM.getState().isLoading;
		},
		LANKA_BENCH_OPTIONS,
	);
});
