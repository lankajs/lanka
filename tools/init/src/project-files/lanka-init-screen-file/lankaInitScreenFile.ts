import type { ILankaInitChoices } from "../../_interfaces/ILankaInitChoices";
import type { ILankaInitFile } from "../../_interfaces/ILankaInitFile";

/**
 * The one file that knows which UI framework was chosen.
 *
 * Everything else this command writes is the same text for all eleven templates,
 * and that is the claim the framework makes rather than a convenience: a
 * ViewModel is a store, so only the READ of one is a framework's business. The
 * seven entries below are that read, seven times.
 *
 * All five bindings publish the same name — `useLankaVM` — and differ only in
 * what the call answers, which is each framework's own idea of reactivity and
 * the one thing a binding cannot abstract away.
 */

const REACT = `import { useEffect } from "react";
import { useLankaVM } from "@lankajs/react";
import { todoVM } from "../../ViewModels/todoVM";

/**
 * The screen: one hook, and nothing else.
 *
 * It holds no loading flag and no retry of its own — those are the ViewModel's,
 * because two screens reading the same ViewModel must not disagree about
 * whether it is loading.
 *
 * The hook re-renders this component only for the keys it actually READ.
 */
export const TodoScreen = () => {
	const { todos, isLoading, error, load } = useLankaVM(todoVM);

	useEffect(() => {
		void load();
	}, [load]);

	if (isLoading) return <p>Loading…</p>;
	if (error !== null) return <p role="alert">{error}</p>;

	return (
		<ul>
			{todos.map((todo) => (
				<li key={todo.id}>{todo.title}</li>
			))}
		</ul>
	);
};
`;

const REACT_NATIVE = `import { useEffect } from "react";
import { Text, View } from "react-native";
import { useLankaVM } from "@lankajs/react";
import { todoVM } from "../../ViewModels/todoVM";

/**
 * The screen: one hook, and nothing else.
 *
 * The same ViewModel the web application would read, and the same hook. What
 * changes on a device is the primitives it renders into — which is the whole
 * point of keeping the state out of the view.
 */
export const TodoScreen = () => {
	const { todos, isLoading, error, load } = useLankaVM(todoVM);

	useEffect(() => {
		void load();
	}, [load]);

	if (isLoading) return <Text>Loading…</Text>;
	if (error !== null) return <Text>{error}</Text>;

	return (
		<View>
			{todos.map((todo) => (
				<Text key={todo.id}>{todo.title}</Text>
			))}
		</View>
	);
};
`;

const VUE = `<script setup lang="ts">
import { onMounted } from "vue";
import { useLankaVM } from "@lankajs/vue";
import { todoVM } from "../../ViewModels/todoVM";

/**
 * The screen: one composable, and nothing else.
 *
 * \`useLankaVM\` answers a \`ShallowRef\`, which is Vue's own idea of
 * reactivity — the one thing the five bindings do not make uniform, because
 * hiding it would be a second reactivity system fighting the first.
 */
const state = useLankaVM(todoVM);

onMounted(() => {
	void state.load();
});
</script>

<template>
	<p v-if="state.isLoading">Loading…</p>
	<p v-else-if="state.error !== null" role="alert">{{ state.error }}</p>
	<ul v-else>
		<li v-for="todo in state.todos" :key="todo.id">{{ todo.title }}</li>
	</ul>
</template>
`;

const SVELTE = `<script lang="ts">
	import { onMount } from "svelte";
	import { useLankaVM } from "@lankajs/svelte";
	import { todoVM } from "../../ViewModels/todoVM";

	/**
	 * The screen: one call, and nothing else.
	 *
	 * \`useLankaVM\` answers an object whose properties are getters, which is what
	 * a rune reads — Svelte's own idea of reactivity, and the one thing the five
	 * bindings do not make uniform.
	 */
	const state = useLankaVM(todoVM);

	onMount(() => {
		void state.load();
	});
</script>

{#if state.isLoading}
	<p>Loading…</p>
{:else if state.error !== null}
	<p role="alert">{state.error}</p>
{:else}
	<ul>
		{#each state.todos as todo (todo.id)}
			<li>{todo.title}</li>
		{/each}
	</ul>
{/if}
`;

const SOLID = `import { For, Show, onMount } from "solid-js";
import { useLankaVM } from "@lankajs/solid";
import { todoVM } from "../../ViewModels/todoVM";

/**
 * The screen: one call, and nothing else.
 *
 * \`useLankaVM\` answers an \`Accessor\`, so every read is \`state()\` — Solid's
 * own idea of reactivity, and the one thing the five bindings do not make
 * uniform.
 */
export const TodoScreen = () => {
	const state = useLankaVM(todoVM);

	onMount(() => {
		void state().load();
	});

	return (
		<Show when={!state().isLoading} fallback={<p>Loading…</p>}>
			<ul>
				<For each={state().todos}>{(todo) => <li>{todo.title}</li>}</For>
			</ul>
		</Show>
	);
};
`;

const ANGULAR = `import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { useLankaVM } from "@lankajs/angular";
import { todoVM } from "../../ViewModels/todoVM";

/**
 * The screen: one call, and nothing else.
 *
 * \`useLankaVM\` answers a \`Signal\`, which is exactly what zoneless change
 * detection reads — so this is the shape Angular is moving towards rather than
 * a bridge to it, and it works unchanged with zones.
 */
@Component({
	selector: "app-todo-screen",
	standalone: true,
	imports: [CommonModule],
	template: \`
		<p *ngIf="state().isLoading">Loading…</p>
		<p *ngIf="state().error as message" role="alert">{{ message }}</p>
		<ul *ngIf="!state().isLoading">
			<li *ngFor="let todo of state().todos">{{ todo.title }}</li>
		</ul>
	\`,
})
export class TodoScreen implements OnInit {
	public readonly state = useLankaVM(todoVM);

	public ngOnInit(): void {
		void this.state().load();
	}
}
`;

const DOM = `import { todoVM } from "../../ViewModels/todoVM";

/**
 * The screen, with no framework at all.
 *
 * This is the whole of what a binding IS, with the renderer taken out:
 * \`subscribe\`, and something to do with the answer. The five bindings call
 * their framework's own subscription primitive instead of this one, and nothing
 * above this line changes between them.
 */
export const mountTodoScreen = (into: HTMLElement): (() => void) => {
	const draw = (): void => {
		const { todos, isLoading, error } = todoVM.getState();

		if (isLoading) {
			into.textContent = "Loading…";
			return;
		}

		if (error !== null) {
			into.textContent = error;
			return;
		}

		into.replaceChildren(
			...todos.map((todo) => {
				const row = document.createElement("li");
				row.textContent = todo.title;
				return row;
			}),
		);
	};

	const stop = todoVM.subscribe(draw);

	draw();
	void todoVM.getState().load();

	return stop;
};
`;

const NODE = `import { startApp } from "./startApp";
import { todoVM } from "./ViewModels/todoVM";

/**
 * The whole service: start the framework, watch one ViewModel, stop.
 *
 * Two lifetimes live in a process like this one and getting them backwards is
 * the bug. THIS is the process's own view of the world, and one instance is
 * right for it. Work done FOR A CALLER — a request, a job, a message — gets its
 * own instance instead, through \`runLankaRequest\` in \`@lankajs/host\`, or one
 * caller's state is answered to another.
 */
const lanka = await startApp();

const stop = todoVM.subscribe((next, previous) => {
	if (next.todos.length === previous.todos.length) return;

	console.log(\`todos: \${String(next.todos.length)}\`);
});

await todoVM.getState().load();

stop();
lanka.dispose();
`;

/** Which read this project needs, by what it renders into rather than by name. */
const screenKind = (choices: ILankaInitChoices): string => {
	const { framework, build, runtime } = choices.template;

	if (framework === null) return runtime.includes("browser") ? "dom" : "node";

	return framework === "react" && build === "metro" ? "react-native" : framework;
};

const SCREENS: Readonly<Record<string, ILankaInitFile>> = {
	react: {
		path: "src/Modules/Todo/TodoScreen.tsx",
		text: REACT,
		gist: "the screen: one hook, no state of its own",
	},
	"react-native": {
		path: "src/Modules/Todo/TodoScreen.tsx",
		text: REACT_NATIVE,
		gist: "the screen: the same hook, rendering a device's primitives",
	},
	vue: {
		path: "src/Modules/Todo/TodoScreen.vue",
		text: VUE,
		gist: "the screen: one composable, answering a ShallowRef",
	},
	svelte: {
		path: "src/Modules/Todo/TodoScreen.svelte",
		text: SVELTE,
		gist: "the screen: one call, read by runes",
	},
	solid: {
		path: "src/Modules/Todo/TodoScreen.tsx",
		text: SOLID,
		gist: "the screen: one call, answering an Accessor",
	},
	angular: {
		path: "src/Modules/Todo/TodoScreen.ts",
		text: ANGULAR,
		gist: "the screen: one call, answering a Signal",
	},
	dom: {
		path: "src/Modules/Todo/mountTodoScreen.ts",
		text: DOM,
		gist: "the screen: subscribe, and redraw",
	},
	node: {
		path: "src/main.ts",
		text: NODE,
		gist: "the service: start, watch one ViewModel, stop",
	},
};

/**
 * The screen, as a list of nothing or one.
 *
 * A list rather than an optional file so the caller composes rather than
 * branches: `...lankaInitScreenFile(choices)` reads the same whether or not this
 * template has a screen, and a twelfth template cannot forget to handle the
 * absent case.
 */
export const lankaInitScreenFile = (choices: ILankaInitChoices): readonly ILankaInitFile[] => {
	const screen = SCREENS[screenKind(choices)];

	return screen === undefined ? [] : [screen];
};
