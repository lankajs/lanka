<script setup lang="ts">
import { useFetch } from "nuxt/app";
import AtlasMissionList from "./components/AtlasMissionList.vue";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * The page: fetch on the server, hand the result down as a prop.
 *
 * `useFetch` is Nuxt's word for "run this where the page is rendered and carry
 * the answer to the browser", and what it calls is the route handler — which is
 * where the framework instance is scoped. The component below never fetches.
 *
 * Imported by name rather than left to Nuxt's auto-import, which is a taste this
 * repository already has: a name with no import line is a name a reader cannot
 * follow, and here it would also make the typecheck depend on generated files.
 */
const { data } = await useFetch<IAtlasMission[]>("/api/missions");
</script>

<template>
	<main>
		<AtlasMissionList :missions="data ?? []" />
	</main>
</template>
