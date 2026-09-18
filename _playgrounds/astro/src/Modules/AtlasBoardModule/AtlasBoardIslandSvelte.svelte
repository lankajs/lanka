<script lang="ts">
	import { AtlasMissionGateway, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
	import { formatAtlasMissionLine, useAtlasMissions } from "@lanka-playgrounds/svelte-shared";
	import { hydrateLankaVM } from "@lankajs/host";
	import type { IAtlasMission } from "@lanka-playgrounds/_shared";

	/**
	 * The same island, in Svelte.
	 *
	 * Read it beside the React and Vue islands on the same page: the prop is the
	 * same prop, the hydration is the same call, and the ViewModel underneath all
	 * three is the same one. What differs is the syntax and nothing else.
	 *
	 * The ViewModel is built in the INSTANCE script rather than at module level,
	 * unlike Vue's island next to it, and that is each framework's own rule rather
	 * than a disagreement: an instance script runs once per mount, which for an
	 * island mounted once per page is the same lifetime — and it is the one that
	 * stays correct if this component is ever rendered on a server.
	 */
	const { missions }: { missions: readonly IAtlasMission[] } = $props();

	// svelte-ignore state_referenced_locally
	const missionsVM = createAtlasMissionsVM(new AtlasMissionGateway());

	// svelte-ignore state_referenced_locally
	hydrateLankaVM(missionsVM, { missions });

	const board = useAtlasMissions(missionsVM);
</script>

<section aria-label="Missions in Svelte">
	<input
		aria-label="Search Svelte missions"
		value={board.search}
		oninput={(event) => board.applySearch((event.currentTarget as HTMLInputElement).value)}
	/>
	<ul>
		{#each board.rows().items as row (row.id)}
			<li>{formatAtlasMissionLine(row)}</li>
		{/each}
	</ul>
</section>
