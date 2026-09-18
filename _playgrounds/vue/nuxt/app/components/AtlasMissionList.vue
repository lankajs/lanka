<script lang="ts">
import { AtlasMissionGateway, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";

/**
 * The ViewModel, built once for this process.
 *
 * A PLAIN `<script>` block, not `<script setup>`, and the difference is the
 * whole of this file's lesson. `<script setup>` IS the `setup()` function: its
 * body runs once per component INSTANCE, so a ViewModel declared there is a new
 * store for every mount — and `hydrateLankaVM`, which applies once per store,
 * then applies to every one of them. A second render with different data
 * replaced the first one's rows, which is exactly what hydration is supposed to
 * refuse, and the screen looked right until two of them existed.
 *
 * React's `.tsx` has no such seam: a `const` beside the component is module
 * level and that is all it can be. This is where the two frameworks differ in a
 * way a consumer meets on their first server-rendered page.
 *
 * So: one module, one store, one process. In a browser that is one per tab; on
 * a server it is one shared by every user connected to it, which is safe here
 * because nothing user-specific is written into it — the server's rows are
 * hydrated and the screen reads.
 */
const missionsVM = createAtlasMissionsVM(new AtlasMissionGateway());

export { missionsVM };
</script>

<script setup lang="ts">
import { formatAtlasMissionLine, useAtlasMissions } from "@lanka-playgrounds/vue-shared";
import { hydrateLankaVM } from "@lankajs/host";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * The board, starting from what the server already had.
 *
 * The handoff is DATA, not state: the Nitro route fetched through a gateway
 * inside a scope, Nuxt carried the result to the browser in its payload, and
 * `hydrateLankaVM` makes it the ViewModel's first state. There is no second
 * request from the browser for what the HTML already contained.
 *
 * ## No `"use client"`, and nothing standing in for it
 *
 * That directive is React Server Components' mechanism and Vue has none: this
 * component runs on both sides, so the ViewModel above is created on the server
 * too. What makes that safe is that hydration applies ONCE per store — not a
 * directive.
 *
 * A page that wrote a USER's draft into that store would need the scoped
 * ViewModel phase 14.8 is for, and this application's README says so where a
 * reader will meet it.
 */
const props = defineProps<{ missions: readonly IAtlasMission[] }>();

hydrateLankaVM(missionsVM, { missions: props.missions });

const state = useAtlasMissions(missionsVM);
</script>

<template>
	<section aria-label="Missions">
		<input
			aria-label="Search missions"
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
