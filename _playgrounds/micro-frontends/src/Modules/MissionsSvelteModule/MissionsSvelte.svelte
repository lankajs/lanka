<script lang="ts">
	import { useLankaVM } from "@lankajs/svelte";
	import type { ILankaReadableVM } from "lanka/viewmodel";
	import type { IAtlasMissionsActions, IAtlasMissionsState } from "@lanka-playgrounds/_shared";

	/**
	 * The Svelte module's screen: the list, read through Svelte's binding.
	 *
	 * The ViewModel arrives as a prop because the MOUNT resolved it — in the scope
	 * the shell handed over — and a component that resolved its own would decide
	 * a lifetime it does not own.
	 */
	const {
		viewModel,
	}: { viewModel: ILankaReadableVM<IAtlasMissionsState & IAtlasMissionsActions> } = $props();

	// svelte-ignore state_referenced_locally
	const missions = useLankaVM(viewModel);
</script>

<ul aria-label="Missions in Svelte">
	{#each missions.rows().items as mission (mission.id)}
		<li>{`${mission.code} ${mission.title}`}</li>
	{/each}
</ul>
