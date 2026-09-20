import { defineComponent, h } from "vue";
import { usePlaygroundClassTodosVM } from "../use-playground-class-todos-vm/usePlaygroundClassTodosVM";

/**
 * The screen a consumer writes over a CLASS, and it is the declared screen
 * character for character.
 *
 * Which is the point: what the class style costs is one wrapper in the
 * declaration file, and nothing at all here. `setup` calls the module, reads
 * `state.value` because the call answers a ref, and cannot tell whether a
 * factory or a class was on the other side of it.
 */
export const PlaygroundClassTodoScreen = defineComponent({
	name: "PlaygroundClassTodoScreen",
	setup() {
		const state = usePlaygroundClassTodosVM();

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
