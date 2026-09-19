<script lang="ts">
	import { useLankaVM } from "../use-lanka-vm/useLankaVM";
	import type { ILankaReadableVM } from "lanka/viewmodel";

	// A fixture for `renderWithLanka.test.ts`, not the application under
	// `_playground/`. Svelte Testing Library's `render` needs an actual `.svelte`
	// file — there is no way to write a component inline in a `.ts` test the way
	// JSX lets React's spec do it.
	const { viewModel }: { viewModel: ILankaReadableVM<{ seen: number }> } = $props();

	const state = useLankaVM(viewModel);
</script>

<div data-testid="seen">{state.seen}</div>
