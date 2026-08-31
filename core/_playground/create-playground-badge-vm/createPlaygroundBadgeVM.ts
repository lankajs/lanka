import { createSharedStoreLankaVM } from "../../src/viewmodel/index";
import type {
	IPlaygroundSelection,
	PlaygroundTodoStore,
} from "../playground-todo-store/PlaygroundTodoStore";

/** What the badge can do: select, and clear. */
export interface IPlaygroundBadgeActions {
	select: (id: number) => void;
	clear: () => void;
}

/**
 * A second reader of the shared selection.
 *
 * It owns no state of its own: everything it shows lives in the store, so the
 * two ViewModels cannot drift apart. What each one owns is its ACTIONS — the
 * badge clears a selection, the list makes one.
 */
export const createPlaygroundBadgeVM = (store: PlaygroundTodoStore) =>
	createSharedStoreLankaVM<IPlaygroundSelection, IPlaygroundBadgeActions, PlaygroundTodoStore>({
		name: "PlaygroundBadgeVM",
		store,
		createActions: ({ set }) => ({
			select: (id: number) => {
				set({ selectedId: id });
			},
			clear: () => {
				set({ selectedId: null });
			},
		}),
	});
