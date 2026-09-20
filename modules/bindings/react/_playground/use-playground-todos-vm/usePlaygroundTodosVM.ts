import { createLankaVM } from "lanka/viewmodel";
import { toLankaReactVM } from "../../src/index";
import type { IPlaygroundTodoActions } from "../_interfaces/IPlaygroundTodoActions";
import type { IPlaygroundTodosState } from "../_interfaces/IPlaygroundTodosState";

/**
 * The file a consumer arriving from 1.x owns, after the migration.
 *
 * ## Why it is a whole module and not a fixture
 *
 * Every other callable scene here builds its ViewModel INSIDE the test and hands
 * it to a screen as a prop. That is convenient and it is not what anybody wrote:
 * on 1.x a ViewModel was declared at MODULE level and imported by name, because
 * `createLankaVM` answered the hook itself and there was nothing else to do with
 * it. Module level is also where the lifetime defects live — a subscription
 * opened at import time is outside every component's scope, so nothing releases
 * it and every reader shares one recording, which is the defect measured in
 * `defineLankaComposable` and would be invisible in a per-test fixture.
 *
 * So this file is the migration itself, in the two lines the 2.0 changeset asks
 * for: the ViewModel built framework-free exactly as Vue and Svelte receive it,
 * and the same object handed back callable.
 *
 * ```diff
 * -export const usePlaygroundTodosVM = createLankaVM<…>({ … });
 * +const todosVM = createLankaVM<…>({ … });
 * +export const usePlaygroundTodosVM = toLankaReactVM(todosVM);
 * ```
 *
 * Nothing below the export changes, in this file or in any screen that imports
 * it, and `migration.test.tsx` is what holds that to be true.
 */
const todosVM = createLankaVM<IPlaygroundTodosState, IPlaygroundTodoActions>({
	name: "PlaygroundTodosVM",
	states: { todos: [], error: null, isLoading: false, unread: 0 },
	createActions: ({ get, set }) => ({
		load: async () => {
			set({ isLoading: true });
			await Promise.resolve();
			set({
				todos: [
					{ id: 1, title: "write the canon", done: false },
					{ id: 2, title: "run the canon", done: false },
				],
				isLoading: false,
			});
		},

		fail: (message) => {
			set({ error: message, isLoading: false });
		},

		complete: (id) => {
			set({
				todos: get().todos.map((todo) => (todo.id === id ? { ...todo, done: true } : todo)),
			});
		},

		/** Moves a key no screen reads, which is how a skipped render is observed. */
		touchUnread: () => {
			set({ unread: get().unread + 1 });
		},
	}),
});

/**
 * The ViewModel above, callable — and still the ViewModel.
 *
 * `usePlaygroundTodosVM()` in a screen, `usePlaygroundTodosVM.getState()` in a
 * loader, and `useLankaVM(usePlaygroundTodosVM)` from any binding on the shelf,
 * because the wrapper forwards rather than copies.
 */
export const usePlaygroundTodosVM = toLankaReactVM(todosVM);
