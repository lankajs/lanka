import { ALankaVM } from "lanka/viewmodel";
import { toLankaCallableVM } from "../../src/index";
import { playgroundVMBuildLog } from "../playground-vm-build-log/playgroundVMBuildLog";

/** Everything the class todo screen can read. */
interface IPlaygroundClassTodosState {
	heading: string;
	titles: string[];
}

/** Everything it can do. */
interface IPlaygroundClassTodosActions {
	load: () => void;
}

/**
 * The same ViewModel again, written as a CLASS — which is the style this
 * package's six factories cannot reach.
 *
 * A class names itself, declares its own state and writes through `this.set`,
 * and it says nothing about Angular: no decorator, no `inject`, no injection
 * context. `lanka/viewmodel` is core, and `build()` answers the framework-free
 * ViewModel every binding on the shelf receives.
 */
class PlaygroundClassTodosVM extends ALankaVM<
	IPlaygroundClassTodosState,
	IPlaygroundClassTodosActions
> {
	protected readonly name = "PlaygroundClassTodosVM";

	protected override states(): IPlaygroundClassTodosState {
		return { heading: "the canon, by class", titles: [] };
	}

	protected createActions(): IPlaygroundClassTodosActions {
		playgroundVMBuildLog.push("PlaygroundClassTodosVM");

		return {
			load: () => {
				this.set({ titles: ["write the canon", "run the canon"] });
			},
		};
	}
}

/**
 * The class style in ONE expression, which is what `toLankaCallableVM` is for.
 *
 * Its two siblings in this bucket declare through the binding's own factory and
 * get the read for free. A class cannot: `new PlaygroundClassTodosVM().build()`
 * is core's ViewModel and knows no framework, so the read is applied by hand —
 * and it is applied ONCE, here, rather than at every call site.
 *
 * ```ts
 * export const useRunVM = toLankaCallableVM(new RunVM().build());
 * ```
 *
 * Every member of this shelf publishes that name, so the line a consumer writes
 * is the same line in React, Vue, Svelte, Solid and Angular. What differs is
 * what the CALL answers — here a `Signal`, because this is Angular.
 *
 * At MODULE level, which is where this package had the most to lose and where
 * the declared sibling makes the same point. There is no injection context at
 * import time, and `toLankaSignals` asserts one the moment it is CALLED — so a
 * wrapper built on that would turn this line into a throw the first time
 * anything imported the module. `toLankaCallableVM` pre-applies `useLankaVM`,
 * which asserts per call, and the scene beside this file is the proof: a
 * declaration over a CLASS that survives being imported. `createActions` writes
 * the class's name into `playgroundVMBuildLog`, so a scene can see that this
 * one — unlike the lazy neighbour — built its store at import.
 */
export const usePlaygroundClassTodosVM = toLankaCallableVM(new PlaygroundClassTodosVM().build());
