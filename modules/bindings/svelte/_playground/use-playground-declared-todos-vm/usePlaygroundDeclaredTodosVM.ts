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
 * +import { createLankaVM } from "@lankajs/svelte";
 * ```
 *
 * That is the whole edit. The config is the same config, the generics are the
 * same generics, and what changes is what the declaration ANSWERS: a ViewModel a
 * component may also CALL, with this package's `useLankaVM` already on it — so
 * the call gives back an object of getters, which is Svelte's own idea of a
 * reactive value and the one thing the shelf does not hide.
 *
 * A plain `.ts` module and not `.svelte.ts`: no rune is used here, because the
 * factory is not a read. It runs at IMPORT, outside every effect, and the
 * subscription is opened by whichever effect first reads what the call answers.
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
