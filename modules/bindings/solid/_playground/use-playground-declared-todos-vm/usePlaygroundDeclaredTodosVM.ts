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
 * +import { createLankaVM } from "@lankajs/solid";
 * ```
 *
 * That is the whole edit. The config is the same config, the generics are the
 * same generics, and what changes is what the declaration ANSWERS: a ViewModel a
 * component may also CALL, with this package's `useLankaVM` already on it — so
 * the call gives back a `TLankaVMAccessor`, which is Solid's own idea of a value
 * and the one thing the shelf does not hide.
 *
 * At MODULE level, which is the part no unit test can show — and the reason the
 * pre-applied read is `useLankaVM` and not `toLankaSolidVM`. That one opens a
 * signal and an `onCleanup`, so it must run under an OWNER; applying it here, at
 * import time, would open one subscription belonging to nobody and hand every
 * component on the screen the same one. This file runs with no owner in sight
 * and builds no subscription at all.
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
