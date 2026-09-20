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
 * +import { createLankaVM } from "@lankajs/vue";
 * ```
 *
 * That is the whole edit. The config is the same config, the generics are the
 * same generics, and what changes is what the declaration ANSWERS: a ViewModel a
 * `setup` may also CALL, with this package's `useLankaVM` already on it — so the
 * call gives back an `ILankaVMRef`, which is Vue's own idea of a reactive value
 * and the one thing the shelf does not hide.
 *
 * At MODULE level, which is the part no unit test can show. The factory runs
 * here, at import time, outside every component and every effect scope: it is
 * `useLankaVM` that is pre-applied, so nothing is subscribed until a `setup`
 * calls the result, and the scope that releases the subscription is the caller's.
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
