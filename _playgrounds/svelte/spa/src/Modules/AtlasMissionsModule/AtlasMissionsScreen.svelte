<script lang="ts">
	import { atlasAvatarUrl } from "@lanka-playgrounds/_shared";
	import { formatAtlasMissionLine, useAtlasMissions } from "@lanka-playgrounds/svelte-shared";
	import { onMount } from "svelte";
	import AtlasAvatar from "./AtlasAvatar.svelte";
	import type { LankaBlobCachePolicy } from "@lankajs/blob-cache";
	import type { TAtlasMissionsVM } from "@lanka-playgrounds/svelte-shared";

	/**
	 * The board, and nothing else.
	 *
	 * It reads ONE view and owns nothing: no loading flag, no retry, no decision
	 * about what a failure means. Every one of those belongs to the ViewModel —
	 * the same sentence the React and Vue screens carry, about the same ViewModel,
	 * with only Svelte's syntax between them.
	 *
	 * `onMount` rather than an effect: the fetch happens ONCE, when the screen
	 * exists. An effect would re-run it for reasons the screen did not ask about,
	 * and `void` because the callback cannot await — the ViewModel already owns
	 * what a failure means.
	 */
	const { missionsVM, avatars }: { missionsVM: TAtlasMissionsVM; avatars: LankaBlobCachePolicy } =
		$props();

	/**
	 * A ViewModel is an IDENTITY, not a value that changes.
	 *
	 * Svelte warns because a prop read at the top level captures its FIRST value,
	 * and for an ordinary prop that is a bug. Here it is the contract: the screen
	 * subscribes to this ViewModel once and unsubscribes when it unmounts, and a
	 * parent that handed it a different one would be replacing the screen, not
	 * updating it. Reading it in a closure would buy a re-subscription nothing
	 * ever asks for.
	 */
	// svelte-ignore state_referenced_locally
	const missions = useAtlasMissions(missionsVM);

	onMount(() => {
		void missions.fetchMissions();

		return missions.stop;
	});
</script>

<section aria-label="Missions">
	<header>
		<input
			aria-label="Search missions"
			value={missions.search}
			oninput={(event) =>
				missions.applySearch((event.currentTarget as HTMLInputElement).value)}
		/>
		<button type="button" onclick={() => missions.sortBy("priority")}>Sort by priority</button>
	</header>

	{#if missions.error !== null}
		<p role="alert">{missions.error}</p>
	{/if}
	{#if missions.isLoading}
		<p role="status">Loading the board…</p>
	{/if}

	<ul>
		{#each missions.rows().items as row (row.id)}
			<li>
				{#if row.crewId !== null}
					<AtlasAvatar
						cache={avatars}
						url={atlasAvatarUrl(row.crewId)}
						name={row.crewId}
					/>
				{/if}
				{formatAtlasMissionLine(row)}
				<button type="button" onclick={() => missions.completeMission(row.id)}>
					Complete {row.code}
				</button>
			</li>
		{/each}
	</ul>

	<footer>
		<button
			type="button"
			disabled={missions.page <= 1}
			onclick={() => missions.goToPage(missions.page - 1)}>Previous</button
		>
		<span data-testid="page">{missions.page} / {missions.rows().totalPages}</span>
		<button
			type="button"
			disabled={missions.page >= missions.rows().totalPages}
			onclick={() => missions.goToPage(missions.page + 1)}>Next</button
		>
	</footer>
</section>
