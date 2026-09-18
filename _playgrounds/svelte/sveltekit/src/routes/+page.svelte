<script lang="ts">
	import AtlasMissionList from "$lib/Modules/AtlasMissionsModule/AtlasMissionList.svelte";
	import type { PageData } from "./$types";

	/**
	 * The page: what `+page.server.ts` loaded, handed to one component.
	 *
	 * Three lines, like every other host's page in this folder. `data` is Kit's
	 * name for the load function's return, and the only thing this file decides is
	 * which component reads it.
	 */
	const { data }: { data: PageData } = $props();
</script>

<main>
	<AtlasMissionList missions={data.missions} />
</main>
