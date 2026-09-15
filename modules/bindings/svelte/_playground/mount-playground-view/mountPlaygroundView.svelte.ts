import { flushSync } from "svelte";
import { useLankaVM } from "../../src/index";
import type {
	ILankaConformanceState,
	ILankaMountedBinding,
} from "@lankajs/tool-testing/lankaViewBindingConformance";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * Svelte's half of the conformance adapter, in a module the compiler sees.
 *
 * `$effect` and `$effect.root` are RUNES — compiler syntax, not runtime exports
 * — so the only way to drive Svelte's reactive graph from a test is a
 * `.svelte.ts` module. The package's own `src/` needs none of this, which is the
 * distinction worth keeping: a consumer's build compiles their components, and
 * this binding is not one.
 *
 * An effect rather than a component: what the suite counts is how often a reader
 * RE-READ, and in Svelte that is an effect run. A component would add a renderer
 * between the question and the answer.
 */
export const mountPlaygroundView = (
	viewModel: ILankaReadableVM<ILankaConformanceState>,
	read: (state: ILankaConformanceState) => void,
): Omit<ILankaMountedBinding, "act"> => {
	let renders = 0;

	const view = useLankaVM(viewModel);

	const destroy = $effect.root(() => {
		$effect(() => {
			renders += 1;
			read(view);
		});
	});

	// Svelte schedules an effect for the next microtask, and the suite reads the
	// first render synchronously — as every framework's consumer does. Settling
	// here is what `act` does for later changes; without it the first scene sees a
	// reader that has not read yet.
	flushSync();

	return {
		renders: () => renders,
		unmount: () => {
			destroy();
			view.stop();
		},
	};
};
