import { defineComponent, h } from "vue";
import { useLankaVM } from "../../src/index";
import type { ILankaFakeVMActions, ILankaFakeVMState } from "@lankajs/tool-testing";
import type { ILankaReadableVM } from "lanka/viewmodel";
import type { PropType } from "vue";

type TTodosVM = ILankaReadableVM<ILankaFakeVMState & ILankaFakeVMActions>;

/**
 * The screen. Reads state, calls actions, and decides nothing.
 *
 * The same sentence `@lankajs/react`'s playground says, because it is the same
 * ViewModel and the same call — the two files differ only in Vue's and React's
 * own syntax, which is what a `parallel` shelf means.
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
			const { rows, error, isLoading } = state.value;

			if (error !== null) return h("p", { role: "alert" }, error);
			if (isLoading) return h("p", "loading");

			return h(
				"ul",
				rows.map((row) => h("li", { key: row }, row)),
			);
		};
	},
});
