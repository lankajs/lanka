import { describe } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { render } from "@testing-library/vue";
import { lankaViewBindingConformance } from "@lankajs/tool-testing/lankaViewBindingConformance";
import { useLankaVM } from "../src/index";
import type {
	ILankaConformanceState,
	ILankaMountedBinding,
} from "@lankajs/tool-testing/lankaViewBindingConformance";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * The list this binding is held to, written independently of it.
 *
 * The same eleven scenes `@lankajs/react` runs, in the same words. What is
 * written here is only how Vue mounts, counts and unmounts — and that this file
 * needed no scene reworded is the evidence the port is a ViewModel's shape
 * rather than React's.
 */
describe("the Vue binding", () => {
	lankaViewBindingConformance({
		vendor: "Vue",

		mount: (
			viewModel: ILankaReadableVM<ILankaConformanceState>,
			read: (state: ILankaConformanceState) => void,
		): ILankaMountedBinding => {
			let renders = 0;

			const Screen = defineComponent({
				setup() {
					const state = useLankaVM(viewModel);

					return () => {
						renders += 1;
						read(state.value);

						return h("span");
					};
				},
			});

			const view = render(Screen);

			return {
				renders: () => renders,
				unmount: () => {
					view.unmount();
				},
				// Vue's scheduler is asynchronous: a change made now renders on the
				// next microtask, and an assertion reading before that would see the
				// render it caused as missing. `flushSync` is React's word for this;
				// Vue's is awaiting `nextTick`, and the suite never assumes which.
				// Vue's scheduler is asynchronous: a change made now renders on the
				// next microtask, and an assertion reading before that would see the
				// render it caused as missing. The suite awaits whatever `act` returns,
				// which is the one thing the second binding made it learn.
				act: async (change) => {
					change();
					await nextTick();
				},
			};
		},

		// NO `renderToString`. Vue's server renderer is asynchronous all the way
		// down — `renderToString(app)` answers a promise, and a component's `setup`
		// may suspend — so a binding cannot hand the suite a string. The scene is
		// SKIPPED by name rather than passed, which is what that half of the
		// adapter is for. `_playgrounds/nuxt` is where server rendering is proved
		// for Vue, because that is where it actually happens.
	});
});
