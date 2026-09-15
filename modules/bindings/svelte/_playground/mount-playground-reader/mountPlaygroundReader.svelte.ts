import { flushSync } from "svelte";

/** One mounted reader: how often it re-read, and how to take it away. */
export interface IPlaygroundMountedReader {
	reads: () => number;
	unmount: () => void;
}

/**
 * Runs one read inside Svelte's reactive graph, and counts the re-runs.
 *
 * `$effect` and `$effect.root` are RUNES — compiler syntax, not runtime exports —
 * so a test file cannot use them and this module can. What it takes is the read
 * itself, which is what lets one helper serve every scene: a whole view, one
 * field of a form, or a selector's answer.
 *
 * Separate readers matter. A tracker belongs to whoever did the reading, so an
 * effect reading both of a form's fields is one reader of both and is woken by
 * either — correct, and not the claim. "The field that changed, and not its
 * neighbour" is a statement about two of these.
 */
export const mountPlaygroundReader = (read: () => void): IPlaygroundMountedReader => {
	let reads = 0;

	const destroy = $effect.root(() => {
		$effect(() => {
			reads += 1;
			read();
		});
	});

	// Svelte schedules an effect for the next microtask, and a scene reads the
	// first run synchronously — as every framework's consumer does.
	flushSync();

	return {
		reads: () => reads,
		unmount: destroy,
	};
};
