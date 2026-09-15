<script setup lang="ts">
import { AtlasBoardVM, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { shallowRef } from "vue";
import AtlasBoardScreen from "../Modules/AtlasBoardModule/AtlasBoardScreen.vue";
import AtlasMissionsScreen from "../Modules/AtlasMissionsModule/AtlasMissionsScreen.vue";
import type { IAtlasVueApp } from "../startAtlasVue";

/**
 * The shell: every screen at once, over one started application.
 *
 * The ViewModels are built HERE rather than at module level, and that is not a
 * Vue habit — it is what lets this be mounted twice in one process, which is
 * what a test does. A module-level ViewModel is one store per PROCESS: right for
 * a browser tab, wrong for a suite, and wrong for a server.
 *
 * `shallowRef` and not `ref`: a ViewModel is not a value Vue should walk into.
 * Making it deeply reactive would wrap a store in a second reactivity system,
 * which is the one thing a binding exists to avoid.
 */
const props = defineProps<{ app: IAtlasVueApp }>();

const missionsVM = shallowRef(createAtlasMissionsVM(props.app.app.missionGateway));
const boardVM = shallowRef(new AtlasBoardVM(props.app.app.boardGateway).build());
</script>

<template>
	<main>
		<AtlasMissionsScreen :missions-v-m="missionsVM" />
		<AtlasBoardScreen :board-v-m="boardVM" />
	</main>
</template>
