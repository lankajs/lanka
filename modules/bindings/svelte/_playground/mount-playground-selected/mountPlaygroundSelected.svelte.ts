import { flushSync } from "svelte";
import { useLankaVM } from "../../src/index";
import type {
	ILankaConformanceState,
	ILankaMountedBinding,
} from "@lankajs/tool-testing/lankaViewBindingConformance";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * Svelte's half of the conformance adapter, for the SELECTOR arm.
 *
 * Its own module for the reason `mountPlaygroundView` is one: `$effect` and
 * `$effect.root` are RUNES — compiler syntax, not runtime exports — so only a
 * `.svelte.ts` module has them, and a test file does not.
 *
 * Separate from `mountPlaygroundView` rather than a flag on it, because the two
 * read different things: that one reads the whole view and this reads what the
 * selector picked, and a helper doing both would be deciding which by argument.
 *
 * The selected view answers ONE value under `current`, which is Svelte's own
 * convention for a reactive value — so `read` is handed the selection itself,
 * which is what the scenes compare.
 */
export const mountPlaygroundSelected = <TSelected>(
	viewModel: ILankaReadableVM<ILankaConformanceState>,
	selector: (state: ILankaConformanceState) => TSelected,
	read: (selected: TSelected) => void,
): Omit<ILankaMountedBinding, "act"> => {
	let renders = 0;

	const view = useLankaVM(viewModel, selector);

	const destroy = $effect.root(() => {
		$effect(() => {
			renders += 1;
			read(view.current);
		});
	});

	// Svelte schedules an effect for the next microtask, and a scene reads the
	// first run synchronously — as every framework's consumer does.
	flushSync();

	return {
		renders: () => renders,
		unmount: () => {
			destroy();
			view.stop();
		},
	};
};
