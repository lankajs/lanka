import { createLankaVM } from "../../src/index";
import { playgroundVMBuildLog } from "../playground-vm-build-log/playgroundVMBuildLog";

/** Everything the declared todo screen can read. */
interface IPlaygroundDeclaredTodosState {
	heading: string;
	titles: string[];
}

/** Everything it can do. */
interface IPlaygroundDeclaredTodosActions {
	load: () => void;
}

/**
 * The declaration this package's six factories exist for, in one line.
 *
 * ```diff
 * -import { createLankaVM } from "lanka/viewmodel";
 * +import { createLankaVM } from "@lankajs/angular";
 * ```
 *
 * That is the whole edit. The config is the same config, the generics are the
 * same generics, and what changes is what the declaration ANSWERS: a ViewModel a
 * component may also CALL, with this package's `useLankaVM` already on it — so
 * the call gives back a `Signal`, which is Angular's own idea of a value and the
 * one thing the shelf does not hide.
 *
 * At MODULE level, which is where this package had the most to lose. The factory
 * runs HERE, at import time, and there is no injection context at import time:
 * `toLankaSignals` calls `assertInInjectionContext` the moment it is called, so
 * pre-applying THAT would have turned this file into a throw the first time
 * anything imported it. What is pre-applied is `useLankaVM`, which asserts per
 * CALL — inside the component's own injection context, where one exists. The
 * scene beside this file is the proof: a declaration that survives being
 * imported.
 */
export const usePlaygroundDeclaredTodosVM = createLankaVM<
	IPlaygroundDeclaredTodosState,
	IPlaygroundDeclaredTodosActions
>({
	name: "PlaygroundDeclaredTodosVM",
	states: { heading: "the canon", titles: [] },
	createActions: ({ set }) => {
		playgroundVMBuildLog.push("PlaygroundDeclaredTodosVM");

		return {
			load: () => {
				set({ titles: ["write the canon", "run the canon"] });
			},
		};
	},
});
