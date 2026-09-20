<script lang="ts">
	import { usePlaygroundClassTodosVM } from "../use-playground-class-todos-vm/usePlaygroundClassTodosVM";

	// The screen a consumer writes over a CLASS, and it is the declared screen
	// character for character.
	//
	// Which is the point: what the class style costs is one wrapper in the
	// declaration file, and nothing at all here. The component calls the module,
	// reads the getters the call answered, and cannot tell whether a factory or a
	// class was on the other side of it.
	const state = usePlaygroundClassTodosVM();
</script>

<h1>{state.heading}</h1>
<ul>
	{#each state.titles as title (title)}
		<li>{title}</li>
	{/each}
</ul>
