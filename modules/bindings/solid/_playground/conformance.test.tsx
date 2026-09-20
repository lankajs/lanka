import { describe } from "vitest";
import { render } from "@solidjs/testing-library";
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
 * The same scenes every other member runs, in the same words. What is
 * written here is only how Solid mounts and disposes — and that this file
 * reworded no scene is the evidence the port is a ViewModel's shape rather than
 * any one framework's.
 *
 * ## What `renders()` counts in a framework with no re-render
 *
 * A Solid component function runs ONCE. What updates is the DOM node that read
 * the signal, so the JSX expression below is what re-runs, and counting its runs
 * is the same question every other binding answers by counting renders.
 */
describe("the Solid binding", () => {
	lankaViewBindingConformance({
		vendor: "Solid",

		/*
		 * The six this package re-publishes under core's own names, each already
		 * wearing Solid's read. Six one-line forwards, and the assertions are
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

		mountSelected: <TSelected,>(
			viewModel: ILankaReadableVM<ILankaConformanceState>,
			selector: (state: ILankaConformanceState) => TSelected,
			read: (selected: TSelected) => void,
		): ILankaMountedBinding => {
			let renders = 0;

			const Screen = () => {
				const picked = useLankaVM(viewModel, selector);

				return (
					<span>
						{(() => {
							renders += 1;
							read(picked());

							return null;
						})()}
					</span>
				);
			};

			const view = render(() => <Screen />);

			return {
				renders: () => renders,
				unmount: () => {
					view.unmount();
				},
				act: (change) => {
					change();
				},
			};
		},

		mount: (
			viewModel: ILankaReadableVM<ILankaConformanceState>,
			read: (state: ILankaConformanceState) => void,
		): ILankaMountedBinding => {
			let renders = 0;

			const Screen = () => {
				const state = useLankaVM(viewModel);

				return (
					<span>
						{(() => {
							renders += 1;
							read(state());

							return null;
						})()}
					</span>
				);
			};

			const view = render(() => <Screen />);

			return {
				renders: () => renders,
				unmount: () => {
					view.unmount();
				},
				// Solid's scheduler settles synchronously: a signal written outside a
				// batch runs its observers before the setter returns, so there is
				// nothing to await and nothing to flush.
				act: (change) => {
					change();
				},
			};
		},

		/*
		 * NO `renderToString`, and the reason is the compiler rather than the
		 * binding.
		 *
		 * Solid ships two runtimes: `solid-js/web`'s server build is a different
		 * module behind a different export condition, and the JSX above has to be
		 * compiled for strings rather than for the DOM to meet it. That is a second
		 * `vite-plugin-solid` with `ssr: true` in a second config file, which cannot
		 * share a module graph with this one —
		 * `_playgrounds/solid/spa/vitest.server.config.ts` is that arrangement, with
		 * the reason it is two flat configs rather than two projects written on it.
		 *
		 * The scene is SKIPPED BY NAME rather than quietly absent, which is the
		 * whole difference between a question this suite cannot ask here and one
		 * nobody noticed was missing. `_playgrounds/solid/spa/src/Core/Server` is
		 * where a Solid server render is proved, over the same components a browser
		 * is given.
		 */
	});
});
