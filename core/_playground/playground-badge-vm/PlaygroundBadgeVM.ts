import { ALankaSharedStoreVM } from "../../src/viewmodel/index";
import type { IPlaygroundBadgeActions } from "../create-playground-badge-vm/createPlaygroundBadgeVM";
import type {
	IPlaygroundSelection,
	PlaygroundTodoStore,
} from "../playground-todo-store/PlaygroundTodoStore";

/**
 * The same second reader of the shared selection, written as a class.
 *
 * It owns no state: everything it shows lives in the store, so the two
 * ViewModels cannot drift apart. What each owns is its ACTIONS — and here they
 * are written against `this.set`, which writes into the store every other reader
 * of it is listening to.
 */
export class PlaygroundBadgeVM extends ALankaSharedStoreVM<
	IPlaygroundSelection,
	IPlaygroundBadgeActions,
	PlaygroundTodoStore
> {
	protected readonly name = "PlaygroundBadgeVM";

	protected createActions(): IPlaygroundBadgeActions {
		return {
			select: (id: number) => {
				this.set({ selectedId: id });
			},
			clear: () => {
				this.set({ selectedId: null });
			},
		};
	}
}
