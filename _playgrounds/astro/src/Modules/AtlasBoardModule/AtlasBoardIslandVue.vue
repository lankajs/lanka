<script lang="ts">
import { AtlasMissionGateway, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";

/**
 * The ViewModel, built once per browser tab.
 *
 * A PLAIN `<script>` block, not `<script setup>`, for the reason
 * `_playgrounds/vue/nuxt` documents at length: `<script setup>` IS the `setup()`
 * function, so a store declared there is a new one per mount and hydration then
 * applies to every one of them.
 *
 * At module level and only reachable from an ISLAND, which is Astro's word for
 * "a client component": one module means one store per process, and for an
 * island that process is a browser tab.
 */
const missionsVM = createAtlasMissionsVM(new AtlasMissionGateway());

export { missionsVM };
</script>

<script setup lang="ts">
import { formatAtlasMissionLine, useAtlasMissions } from "@lanka-playgrounds/vue-shared";
import { hydrateLankaVM } from "@lankajs/host";
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

hydrateLankaVM(missionsVM, { missions: props.missions });

const state = useAtlasMissions(missionsVM);
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
