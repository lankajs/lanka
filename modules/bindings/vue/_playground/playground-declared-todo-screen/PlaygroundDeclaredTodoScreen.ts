import { defineComponent, h } from "vue";
import { usePlaygroundDeclaredTodosVM } from "../use-playground-declared-todos-vm/usePlaygroundDeclaredTodosVM";

/**
 * The screen a consumer writes over a one-line declaration.
 *
 * It takes no props and imports nothing but the ViewModel, because that is the
 * shape the pre-applied read buys: the declaration is a module, `setup` calls
 * it, and there is no provider, no plugin and no `useLankaVM(todosVM)` in
 * between. Its sibling `PlaygroundTodoScreen` keeps the portable spelling, which
 * is what a screen moving between frameworks is written in.
 *
 * `state.value` because a script reads the ref and a template unwraps it — the
 * call answers `ILankaVMRef`, which is what makes this Vue's screen rather than
 * a translation of React's.
 */
export const PlaygroundDeclaredTodoScreen = defineComponent({
	name: "PlaygroundDeclaredTodoScreen",
	setup() {
		const state = usePlaygroundDeclaredTodosVM();

		return () =>
			h("section", [
				h("h1", state.value.heading),
				h(
					"ul",
					state.value.titles.map((title) => h("li", { key: title }, title)),
				),
			]);
	},
});
