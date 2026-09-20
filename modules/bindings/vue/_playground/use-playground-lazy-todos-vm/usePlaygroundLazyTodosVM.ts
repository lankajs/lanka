import { createLazyLankaVM } from "../../src/index";
import { playgroundVMBuildLog } from "../playground-vm-build-log/playgroundVMBuildLog";

/** Everything the lazy todo screen can read. */
interface IPlaygroundLazyTodosState {
	heading: string;
	titles: string[];
}

/** Everything it can do. */
interface IPlaygroundLazyTodosActions {
	load: () => void;
}

/**
 * The same declaration, lazily — and the claim every docblock in this bucket
 * makes.
 *
 * The callable wrapper forwards through a Proxy rather than copying members, so
 * wrapping a lazy ViewModel does not spend its laziness: this module is imported
 * with every scene in the playground and builds nothing until a `setup` reads
 * it. A wrapper that copied `name`, `getState` and `subscribe` onto a new object
 * would have built the store here, at import, to have something to copy from —
 * which is exactly the cost the lazy factory exists to avoid.
 *
 * `playgroundVMBuildLog` is how a scene sees the difference: its eager neighbour
 * has written its name into that array by the time the suite starts, and this
 * one has not.
 */
export const usePlaygroundLazyTodosVM = createLazyLankaVM<
	IPlaygroundLazyTodosState,
	IPlaygroundLazyTodosActions
>({
	name: "PlaygroundLazyTodosVM",
	states: { heading: "the canon, lazily", titles: [] },
	createActions: ({ set }) => {
		playgroundVMBuildLog.push("PlaygroundLazyTodosVM");

		return {
			load: () => {
				set({ titles: ["write the canon", "run the canon"] });
			},
		};
	},
});
