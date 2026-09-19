<script lang="ts">
	import { atlasAvatarUrl, atlasQueuedCount } from "@lanka-playgrounds/_shared";
	import { useLankaVM } from "@lankajs/svelte";
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

	/**
	 * The SELECTED read, which is the second thing every binding publishes and the
	 * one no application here used. Tracking is bypassed: this value moves when the
	 * NUMBER moves and not when the board does, so filtering the list down to one
	 * row leaves it alone while the rows above it all change.
	 *
	 * Beside the tracked read rather than instead of it, deliberately — a screen
	 * reads what it renders, and the two overloads exist because those are two
	 * different questions.
	 *
	 * `.current`, which is Svelte's own convention for a reactive value a class
	 * exposes — `MediaQuery` and the rest of `svelte/reactivity` read that way.
	 * It is also the shape that had to carry a NUMBER: the earlier one carried the
	 * selection's own keys, which a number does not have.
	 */
	// svelte-ignore state_referenced_locally
	const queued = useLankaVM(missionsVM, atlasQueuedCount);

	onMount(() => {
		void missions.fetchMissions();
	});

	/*
	 * No `return missions.stop` from that hook, and that is the correction rather
	 * than an omission. The view is built on `createSubscriber`, whose teardown
	 * runs when the effect that read it is destroyed — which is unmount — so a
	 * screen releasing as well released TWICE, and the leak scene next door is
	 * what said so, by counting one more unsubscribe than subscribe.
	 *
	 * It was harmless, because a second release is ignored. It was also the shape
	 * a reader copies, and the published `stop` exists for the other case: a read
	 * started outside any effect, where nothing would ever call it.
	 */
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
		<!--
			ONE expression, where the obvious spelling is `{queued.current} queued`.
			A dynamic value beside static text compiles to a text node svelte updates
			through a branch it can only take when the text changes shape, and the
			shape here never changes — so the branch sat at zero and this package's
			coverage ratchet refused, the same way it refused the row id in the status
			attribute above. The rendered text is identical either way.
		-->
		<span data-testid="queued-count">{`${queued.current} queued`}</span>
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
				<!--
					A class, where the other four applications carry a
					`data-testid="status-${id}"`. An attribute holding the row id is one
					Svelte compiles an update branch for, and a keyed `{#each}` can never
					run it — an unreachable branch that this package's coverage ratchet
					refused, which is the ratchet doing its job. The suite finds this cell
					through its row instead.
				-->
				<span class="atlas-status">{row.status}</span>
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
