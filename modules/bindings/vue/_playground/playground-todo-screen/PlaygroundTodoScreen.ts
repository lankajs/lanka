import { defineComponent, h } from "vue";
import { useLankaVM } from "../../src/index";
import type { PropType } from "vue";
import type { ILankaReadableVM } from "lanka/viewmodel";
import type { IPlaygroundTodoActions } from "../_interfaces/IPlaygroundTodoActions";
import type { IPlaygroundTodosState } from "../_interfaces/IPlaygroundTodosState";

type TTodosVM = ILankaReadableVM<IPlaygroundTodosState & IPlaygroundTodoActions>;

/**
 * The screen. Reads state, calls actions, and decides nothing.
 *
 * It takes the ViewModel and reaches for it through `useLankaVM` ITSELF — the
 * same sentence `@lankajs/react`'s playground says, because it is the same
 * ViewModel and the same call.
 *
 * A render function rather than an SFC: `.vue` is a file type this repository's
 * structure canon has no rule for, and what an SFC would add here is the
 * compiler rather than the binding. `_playgrounds/vue` is where a consumer's
 * build is proved, and that is where the SFCs live.
 */
export const PlaygroundTodoScreen = defineComponent({
	name: "PlaygroundTodoScreen",
	props: {
		todosVM: { type: Object as PropType<TTodosVM>, required: true },
		onRender: { type: Function as PropType<() => void>, default: undefined },
	},
	setup(props) {
		const state = useLankaVM(props.todosVM);

		return () => {
			props.onRender?.();
			const { todos, error, isLoading } = state.value;

			if (error !== null) return h("p", { role: "alert" }, error);
			if (isLoading) return h("p", "loading");

			return h(
				"ul",
				todos.map((todo) =>
					h("li", { key: todo.id }, todo.done ? `${todo.title} ✓` : todo.title),
				),
			);
		};
	},
});
