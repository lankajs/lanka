import { describe } from "vitest";
import { act, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
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
 * Every member of `modules/bindings/` runs the same eleven scenes. What is
 * written here is only how React mounts, counts and unmounts — the assertions
 * are the shelf's, so a claim this package keeps is a claim every binding keeps.
 *
 * If a scene ever has to be reworded to pass here, the PORT is the shape of
 * React rather than of a ViewModel, and the fix belongs in core.
 */
describe("the React binding", () => {
	lankaViewBindingConformance({
		vendor: "React",

		mountSelected: <TSelected,>(
			viewModel: ILankaReadableVM<ILankaConformanceState>,
			selector: (state: ILankaConformanceState) => TSelected,
			read: (selected: TSelected) => void,
		): ILankaMountedBinding => {
			let renders = 0;

			const Screen = () => {
				const picked = useLankaVM(viewModel, selector);
				renders += 1;
				read(picked);

				return null;
			};

			const view = render(<Screen />);

			return {
				renders: () => renders,
				unmount: () => {
					view.unmount();
				},
				act: (change) => {
					act(change);
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
				renders += 1;
				read(state);

				return null;
			};

			const view = render(<Screen />);

			return {
				renders: () => renders,
				unmount: () => {
					view.unmount();
				},
				// React batches, and a change made outside `act` leaves the tree in a
				// state the next assertion reads before the render it caused.
				act: (change) => {
					act(change);
				},
			};
		},

		renderToString: (viewModel) => {
			const Screen = () => {
				const state = useLankaVM(viewModel);

				return <span>{state.watched}</span>;
			};

			return renderToString(<Screen />);
		},
	});
});
