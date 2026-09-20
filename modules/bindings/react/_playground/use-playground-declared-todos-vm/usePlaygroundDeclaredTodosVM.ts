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
 * +import { createLankaVM } from "@lankajs/react";
 * ```
 *
 * That is the whole edit. The config is the same config, the generics are the
 * same generics, and what changes is what the declaration ANSWERS: a ViewModel
 * that a component may also CALL, with this package's `useLankaVM` already on
 * it. Next door, `usePlaygroundTodosVM` reaches the same shape in two lines —
 * `createLankaVM` from core and `toLankaReactVM` over it — because that file is
 * a migration and this one is what a consumer writes now.
 *
 * At MODULE level, which is the part no unit test can show. The factory runs
 * here, at import time, with no component anywhere: it is `useLankaVM` that is
 * pre-applied and not `toLankaReactVM`'s hook body, so nothing is subscribed,
 * nothing is rendered, and the read happens when a screen calls the result.
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
