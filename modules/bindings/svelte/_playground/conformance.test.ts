import { describe } from "vitest";
import { flushSync } from "svelte";
import { lankaViewBindingConformance } from "@lankajs/tool-testing/lankaViewBindingConformance";
import { mountPlaygroundView } from "./mount-playground-view/mountPlaygroundView.svelte";

/**
 * The list this binding is held to, written independently of it.
 *
 * The same eleven scenes every other member runs, in the same words. What is
 * written here is only how Svelte settles — and that this file reworded no
 * scene is the evidence the port is a ViewModel's shape rather than any one
 * framework's.
 */
describe("the Svelte binding", () => {
	lankaViewBindingConformance({
		vendor: "Svelte",

		mount: (viewModel, read) => ({
			...mountPlaygroundView(viewModel, read),
			// Svelte batches into a microtask; `flushSync` is its word for "settle
			// now", which is what React calls `act` and Vue calls `nextTick`.
			act: (change) => {
				change();
				flushSync();
			},
		}),
	});
});
