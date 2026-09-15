import { describe } from "vitest";
import { render } from "@solidjs/testing-library";
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
 * The same eleven scenes every other member runs, in the same words. What is
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
	});
});
