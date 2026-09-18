<script lang="ts">
	import { useLankaVM } from "@lankajs/svelte";
	import { onMount } from "svelte";
	import type { AtlasBoardVM } from "@lanka-playgrounds/_shared";

	/**
	 * The dispatch board: what the summary says, and what people are saying.
	 *
	 * It reads the binding's shared name rather than a composable of its own,
	 * because there is nothing here two Svelte hosts would share — and a helper
	 * with one caller is a layer with no reason.
	 */
	const { boardVM }: { boardVM: ReturnType<AtlasBoardVM["build"]> } = $props();

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
	const board = useLankaVM(boardVM);

	onMount(() => board.stop);
</script>

<section aria-label="Board">
	<p data-testid="board-summary">
		{board.error ?? (board.summary ? `${board.summary.queued} queued` : "no summary")}
	</p>
	<ul data-testid="board-messages">
		{#each board.messages as message (message.at)}
			<li>{message.text}</li>
		{/each}
	</ul>
</section>
