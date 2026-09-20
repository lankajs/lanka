import { describe } from "vitest";
import { createSSRApp, defineComponent, h, nextTick } from "vue";
import { renderToString } from "vue/server-renderer";
import { render } from "@testing-library/vue";
import { lankaViewBindingConformance } from "@lankajs/tool-testing/lankaViewBindingConformance";
import {
	createLankaVM,
	createLazyLankaVM,
	createLazySharedStoreLankaVM,
	createLazyStatelessLankaVM,
	createSharedStoreLankaVM,
	createStatelessLankaVM,
	useLankaVM,
} from "../src/index";
import type {
	ILankaConformanceState,
	ILankaMountedBinding,
} from "@lankajs/tool-testing/lankaViewBindingConformance";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * The list this binding is held to, written independently of it.
 *
 * The same scenes `@lankajs/react` runs, in the same words. What is
 * written here is only how Vue mounts, counts and unmounts — and that this file
 * needed no scene reworded is the evidence the port is a ViewModel's shape
 * rather than React's.
 */
describe("the Vue binding", () => {
	lankaViewBindingConformance({
		vendor: "Vue",

		/*
		 * The six this package re-publishes under core's own names, each already
		 * wearing Vue's read. Six one-line forwards, and the assertions are
		 * the shelf's — which is the point: five packages making one promise had
		 * been asserting it five times, in five sets of words.
		 */
		declare: {
			createLankaVM: (config) => createLankaVM(config),
			createLazyLankaVM: (config) => createLazyLankaVM(config),
			createStatelessLankaVM: (config) => createStatelessLankaVM(config),
			createLazyStatelessLankaVM: (config) => createLazyStatelessLankaVM(config),
			createSharedStoreLankaVM: (config) => createSharedStoreLankaVM(config),
			createLazySharedStoreLankaVM: (config) => createLazySharedStoreLankaVM(config),
		},

		mountSelected: <TSelected>(
			viewModel: ILankaReadableVM<ILankaConformanceState>,
			selector: (state: ILankaConformanceState) => TSelected,
			read: (selected: TSelected) => void,
		): ILankaMountedBinding => {
			let renders = 0;

			const Screen = defineComponent({
				setup() {
					const picked = useLankaVM(viewModel, selector);

					return () => {
						renders += 1;
						read(picked.value);

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
				act: async (change) => {
					change();
					await nextTick();
				},
			};
		},

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
				// render it caused as missing. `flushSync` is React's word for this and
				// `nextTick` is Vue's; the suite awaits whatever `act` returns and never
				// assumes which, which is the one thing the second binding made it learn.
				act: async (change) => {
					change();
					await nextTick();
				},
			};
		},

		/**
		 * Vue's server renderer, which the suite CAN take.
		 *
		 * This half of the adapter was empty, and the reason written here was that
		 * `renderToString(app)` answers a promise so a binding could not hand the
		 * suite a string. The suite's own signature says `string | Promise<string>`
		 * and every scene awaits what it is given — the second binding taught it
		 * that — so the reason had stopped being true and the scene went on being
		 * skipped. A scene skipped for a stale reason is the fourth way a check
		 * reports success: it never asked the question.
		 *
		 * It asked it, and the answer was a leak. `useLankaVM` subscribed during
		 * `setup`, and on a server nothing unmounts — the instance's scope is never
		 * stopped, so `onScopeDispose` never runs and every request left a listener
		 * on a module-level ViewModel for the life of the process.
		 */
		renderToString: async (viewModel) => {
			const Screen = defineComponent({
				setup() {
					const state = useLankaVM(viewModel);

					return () => h("span", state.value.watched);
				},
			});

			return renderToString(createSSRApp(Screen));
		},
	});
});
