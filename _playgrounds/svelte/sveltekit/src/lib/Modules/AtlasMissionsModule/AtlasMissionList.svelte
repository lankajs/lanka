<script lang="ts">
	import { AtlasMissionGateway, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
	import { formatAtlasMissionLine, useAtlasMissions } from "@lanka-playgrounds/svelte-shared";
	import { hydrateLankaVM } from "@lankajs/host";
	import type { IAtlasMission } from "@lanka-playgrounds/_shared";

	/**
	 * The board, starting from what the server already had.
	 *
	 * The handoff is DATA, not state: `+page.server.ts` fetched through a gateway
	 * inside a request scope, Kit carried the result to the browser in its
	 * serialised `data`, and `hydrateLankaVM` makes it this ViewModel's first
	 * state. There is no second request from the browser for what the HTML already
	 * contained.
	 *
	 * ## The ViewModel is per INSTANCE here, and in Nuxt it is per module
	 *
	 * That is not a preference, it is the two frameworks' own rule. Kit's docs say
	 * it outright: on the server, module-level state is shared by every user
	 * connected to that process, so a ViewModel declared beside this component
	 * would be one store for the whole deployment — and the first request to write
	 * a user's draft into it would serve that draft to the next stranger.
	 *
	 * `_playgrounds/vue/nuxt` had to go the other way, because Vue's
	 * `<script setup>` IS the `setup()` function and a module-level store was the
	 * only way to make hydration apply once. Here the instance script runs per
	 * render on the server AND per mount in the browser, which is exactly the
	 * lifetime a hydrated store wants: one store, one page, one reader.
	 *
	 * ## No `"use client"`, and nothing standing in for it
	 *
	 * That directive is React Server Components' mechanism and Kit has none: this
	 * component runs on both sides, and what keeps it correct is the lifetime
	 * above rather than a marker.
	 */
	const { missions }: { missions: readonly IAtlasMission[] } = $props();

	// svelte-ignore state_referenced_locally
	const missionsVM = createAtlasMissionsVM(new AtlasMissionGateway());

	// svelte-ignore state_referenced_locally
	hydrateLankaVM(missionsVM, { missions });

	const board = useAtlasMissions(missionsVM);
</script>

<section aria-label="Missions">
	<input
		aria-label="Search missions"
		value={board.search}
		oninput={(event) => board.applySearch((event.currentTarget as HTMLInputElement).value)}
	/>
	<ul>
		{#each board.rows().items as row (row.id)}
			<li>{formatAtlasMissionLine(row)}</li>
		{/each}
	</ul>
</section>
