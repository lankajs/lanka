import { flushSync } from "svelte";

/** What one probe answers: how many times its body has run, and how to tear it down. */
export interface ILankaEffectProbe {
	/** How many times the body has run so far. */
	runs: () => number;
	/** Destroys the effect root, the way a component's own teardown would. */
	destroy: () => void;
}

/**
 * Runs `body` inside a live Svelte effect, and settles the first run.
 *
 * `createSubscriber`'s own `start` callback fires only when its returned
 * function is called from WITHIN an effect — `effect_tracking()`, in Svelte's
 * own source, guards it — so a spec proving WHEN a subscription opens, or that
 * `stop()` actually cuts one, needs a real effect and not a plain function call.
 * `$effect` and `$effect.root` are runes, compiler syntax rather than runtime
 * exports, which is why this file ends `.svelte.ts` and the specs that use it do
 * not: `mountPlaygroundView.svelte.ts` is this package's other example of the
 * same split.
 */
export const runInLankaEffect = (body: () => void): ILankaEffectProbe => {
	let runs = 0;

	const destroy = $effect.root(() => {
		$effect(() => {
			runs += 1;
			body();
		});
	});

	// Svelte schedules an effect for the next microtask; settling here is what
	// lets the very first run count before the caller makes its first assertion.
	flushSync();

	return {
		runs: () => runs,
		destroy,
	};
};
