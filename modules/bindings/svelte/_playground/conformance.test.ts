import { describe } from "vitest";
import { flushSync } from "svelte";
import { lankaViewBindingConformance } from "@lankajs/tool-testing/lankaViewBindingConformance";
import { mountPlaygroundSelected } from "./mount-playground-selected/mountPlaygroundSelected.svelte";
import { mountPlaygroundView } from "./mount-playground-view/mountPlaygroundView.svelte";

/**
 * The list this binding is held to, written independently of it.
 *
 * The same scenes every other member runs, in the same words. What is
 * written here is only how Svelte settles — and that this file reworded no
 * scene is the evidence the port is a ViewModel's shape rather than any one
 * framework's.
 */
describe("the Svelte binding", () => {
	lankaViewBindingConformance({
		vendor: "Svelte",

		mountSelected: (viewModel, selector, read) => {
			const mounted = mountPlaygroundSelected(viewModel, selector, read);

			return {
				...mounted,
				act: (change) => {
					change();
					flushSync();
				},
			};
		},

		mount: (viewModel, read) => ({
			...mountPlaygroundView(viewModel, read),
			// Svelte batches into a microtask; `flushSync` is its word for "settle
			// now", which is what React calls `act` and Vue calls `nextTick`.
			act: (change) => {
				change();
				flushSync();
			},
		}),

		/*
		 * NO `renderToString`, and the reason is the compiler rather than the
		 * binding.
		 *
		 * `svelte/server`'s `render` takes a component compiled with
		 * `generate: "server"`, and the plugin in this package's config compiles for
		 * the browser — the `conditions` say so, because Svelte's default export
		 * condition in node is the SERVER build and a suite that silently got that
		 * one would assert nothing. Both compilations of one component cannot share
		 * a module graph, so answering this scene here is a second config file:
		 * `_playgrounds/solid/spa/vitest.server.config.ts` is the precedent for what
		 * that costs.
		 *
		 * The scene is SKIPPED BY NAME rather than quietly absent, which is the
		 * whole difference between a question this suite cannot ask here and one
		 * nobody noticed was missing. What the binding does with no effect to read
		 * it — the condition a server render is in — is asserted in
		 * `src/use-lanka-vm/`, where `createSubscriber` can be watched directly.
		 */
	});
});
