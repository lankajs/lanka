<script lang="ts">
	import { usePlaygroundLazyTodosVM } from "../use-playground-lazy-todos-vm/usePlaygroundLazyTodosVM";

	// The same screen over a LAZY declaration, and it reads no differently.
	//
	// Which is the point: laziness is a property of when the store is built, not
	// of how it is read, so the file a consumer writes is the file above with one
	// import changed. The store arrives on the first read this component
	// performs.
	const state = usePlaygroundLazyTodosVM();
</script>

<h1>{state.heading}</h1>
<ul>
	{#each state.titles as title (title)}
		<li>{title}</li>
	{/each}
</ul>
