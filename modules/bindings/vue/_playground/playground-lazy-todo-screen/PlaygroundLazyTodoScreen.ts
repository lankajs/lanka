import { defineComponent, h } from "vue";
import { usePlaygroundLazyTodosVM } from "../use-playground-lazy-todos-vm/usePlaygroundLazyTodosVM";

/**
 * The same screen over a LAZY declaration, and it reads no differently.
 *
 * Which is the point: laziness is a property of when the store is built, not of
 * how it is read, so the file a consumer writes is the file above with one
 * import changed. The store arrives on the first read this `setup` performs.
 */
export const PlaygroundLazyTodoScreen = defineComponent({
	name: "PlaygroundLazyTodoScreen",
	setup() {
		const state = usePlaygroundLazyTodosVM();

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
