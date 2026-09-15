<script setup lang="ts">
import { useLankaVM } from "@lankajs/vue";
import type { AtlasBoardVM } from "@lanka-playgrounds/_shared";

/**
 * The dispatch board: what the summary says, and what people are saying.
 *
 * It reads the binding's shared name rather than a composable of its own,
 * because there is nothing here two Vue hosts would share — and a composable
 * with one caller is a layer with no reason.
 */
const props = defineProps<{ boardVM: ReturnType<AtlasBoardVM["build"]> }>();

const board = useLankaVM(props.boardVM);
</script>

<template>
	<section aria-label="Board">
		<p data-testid="board-summary">
			{{ board.error ?? (board.summary ? `${board.summary.queued} queued` : "no summary") }}
		</p>
		<ul data-testid="board-messages">
			<li v-for="message in board.messages" :key="message.at">
				{{ message.text }}
			</li>
		</ul>
	</section>
</template>
