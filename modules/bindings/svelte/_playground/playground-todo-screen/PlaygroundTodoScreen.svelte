<script lang="ts">
	import { useLankaVM } from "../../src/index";
	import type { ILankaFakeVMActions, ILankaFakeVMState } from "@lankajs/tool-testing";
	import type { ILankaReadableVM } from "lanka/viewmodel";

	// The screen. Reads state, calls actions, and decides nothing.
	//
	// A real `.svelte` component, compiled by the plugin: what `renderWithLanka`
	// renders is a component, and proving the subpath with anything less would be
	// proving something else.
	const { todosVM }: { todosVM: ILankaReadableVM<ILankaFakeVMState & ILankaFakeVMActions> } =
		$props();

	const state = useLankaVM(todosVM);
</script>

{#if state.error !== null}
	<p role="alert">{state.error}</p>
{:else if state.isLoading}
	<p>loading</p>
{:else}
	<ul>
		{#each state.rows as row (row)}
			<li>{row}</li>
		{/each}
	</ul>
{/if}
