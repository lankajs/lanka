<script setup lang="ts">
import { formatAtlasMissionLine, useAtlasMissions } from "@lanka-playgrounds/vue-shared";
import { hydrateLankaVM } from "@lankajs/host";
import { atlasIslandMissionsVM } from "./atlasIslandMissionsVM";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * The same island, in Vue.
 *
 * Read it beside `AtlasBoardIsland.tsx` on the same page: the prop is the same
 * prop, the hydration is the same call, and the ViewModel underneath both is the
 * same one from `@lanka-playgrounds/_shared`. What differs is the syntax and
 * nothing else — which is the claim four islands on one page exist to make.
 */
const props = defineProps<{ missions: readonly IAtlasMission[] }>();

hydrateLankaVM(atlasIslandMissionsVM, { missions: props.missions });

const state = useAtlasMissions(atlasIslandMissionsVM);
</script>

<template>
	<section aria-label="Missions in Vue">
		<input
			aria-label="Search Vue missions"
			:value="state.search"
			@input="state.applySearch(($event.target as HTMLInputElement).value)"
		/>
		<ul>
			<li v-for="row in state.rows().items" :key="row.id">
				{{ formatAtlasMissionLine(row) }}
			</li>
		</ul>
	</section>
</template>
