<script setup lang="ts">
import { atlasAvatarUrl, atlasQueuedCount } from "@lanka-playgrounds/_shared";
import { useLankaVM } from "@lankajs/vue";
import {
	AtlasAvatar,
	formatAtlasMissionLine,
	useAtlasMissionsOnMount,
} from "@lanka-playgrounds/vue-shared";
import type { LankaBlobCachePolicy } from "@lankajs/blob-cache";
import type { TAtlasMissionsVM } from "@lanka-playgrounds/vue-shared";

/**
 * The board, and nothing else.
 *
 * It reads ONE composable and owns nothing: no loading flag, no retry, no
 * decision about what a failure means. Every one of those belongs to the
 * ViewModel — the same sentence `_playgrounds/react/spa`'s screen carries, about
 * the same ViewModel, with only Vue's syntax between them.
 *
 * A single-file component rather than a render function, deliberately: what this
 * application proves is a CONSUMER's build, and a consumer writes SFCs. The
 * binding's own playground uses render functions because a binding needs no
 * compiler; an application does.
 */
const props = defineProps<{ missionsVM: TAtlasMissionsVM; avatars: LankaBlobCachePolicy }>();

const missions = useAtlasMissionsOnMount(props.missionsVM);

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
 * A REF, which is Vue's own answer to "one reactive value": `queued.value` in
 * this block and `queued` in the template, where the compiler unwraps it.
 */
const queued = useLankaVM(props.missionsVM, atlasQueuedCount);
</script>

<template>
	<section aria-label="Missions">
		<header>
			<input
				aria-label="Search missions"
				:value="missions.search"
				@input="missions.applySearch(($event.target as HTMLInputElement).value)"
			/>
			<button type="button" @click="missions.sortBy('priority')">Sort by priority</button>
			<span data-testid="queued-count">{{ queued }} queued</span>
		</header>

		<p v-if="missions.error !== null" role="alert">
			{{ missions.error }}
		</p>
		<p v-if="missions.isLoading" role="status">Loading the board…</p>

		<ul>
			<li v-for="row in missions.rows().items" :key="row.id">
				<AtlasAvatar
					v-if="row.crewId !== null"
					:cache="props.avatars"
					:url="atlasAvatarUrl(row.crewId)"
					:name="row.crewId"
				/>
				{{ formatAtlasMissionLine(row) }}
				<span :data-testid="`status-${row.id}`">{{ row.status }}</span>
				<button type="button" @click="missions.completeMission(row.id)">
					Complete {{ row.code }}
				</button>
			</li>
		</ul>

		<footer>
			<button
				type="button"
				:disabled="missions.page <= 1"
				@click="missions.goToPage(missions.page - 1)"
			>
				Previous
			</button>
			<span data-testid="page">{{ missions.page }} / {{ missions.rows().totalPages }}</span>
			<button
				type="button"
				:disabled="missions.page >= missions.rows().totalPages"
				@click="missions.goToPage(missions.page + 1)"
			>
				Next
			</button>
		</footer>
	</section>
</template>
