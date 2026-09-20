<script lang="ts">
	import { usePlaygroundDeclaredTodosVM } from "../use-playground-declared-todos-vm/usePlaygroundDeclaredTodosVM";

	// The screen a consumer writes over a one-line declaration.
	//
	// It takes no props and imports nothing but the ViewModel, because that is
	// the shape the pre-applied read buys: the declaration is a module, the
	// component calls it, and there is no context, no store and no
	// `useLankaVM(todosVM)` in between. Its sibling `PlaygroundTodoScreen` keeps
	// the portable spelling, which is what a screen moving between frameworks is
	// written in.
	const state = usePlaygroundDeclaredTodosVM();
</script>

<h1>{state.heading}</h1>
<ul>
	{#each state.titles as title (title)}
		<li>{title}</li>
	{/each}
</ul>
