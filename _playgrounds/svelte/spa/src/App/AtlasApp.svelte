<script lang="ts">
	import { AtlasBoardVM, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
	import AtlasBoardScreen from "../Modules/AtlasBoardModule/AtlasBoardScreen.svelte";
	import AtlasMissionsScreen from "../Modules/AtlasMissionsModule/AtlasMissionsScreen.svelte";
	import type { IAtlasSvelteApp } from "../startAtlasSvelte";

	/**
	 * The shell: every screen at once, over one started application.
	 *
	 * The ViewModels are built HERE rather than at module level, and that is not a
	 * Svelte habit — it is what lets this be mounted twice in one process, which
	 * is what a test does. A module-level ViewModel is one store per PROCESS:
	 * right for a browser tab, wrong for a suite, and wrong for a server.
	 *
	 * A component's `<script>` body runs per INSTANCE here, which is the same seam
	 * `_playgrounds/vue/nuxt` documents at length — and here it is the behaviour
	 * wanted rather than the trap, because these ViewModels are meant to be one
	 * per mount.
	 */
	const { app }: { app: IAtlasSvelteApp } = $props();

	/**
	 * The started application is an IDENTITY, not a value that changes.
	 *
	 * Svelte warns because a prop read at the top level captures its FIRST value,
	 * and for an ordinary prop that is a bug. Here it is the contract: a shell is
	 * mounted over ONE started application, and a parent that swapped it would be
	 * replacing the shell, not updating it. Both lines below say so.
	 */
	// svelte-ignore state_referenced_locally
	const missionsVM = createAtlasMissionsVM(app.app.missionGateway);
	// svelte-ignore state_referenced_locally
	const boardVM = new AtlasBoardVM(app.app.boardGateway).build();
</script>

<main>
	<AtlasMissionsScreen {missionsVM} />
	<AtlasBoardScreen {boardVM} />
</main>
