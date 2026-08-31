import { ALankaSharedStore } from "../../src/viewmodel/index";

/** What two screens agree on: which todo is selected right now. */
export interface IPlaygroundSelection {
	selectedId: number | null;
}

/**
 * One store, read and written by more than one ViewModel.
 *
 * The case this exists for is a selection two screens must not disagree about.
 * Passing it down as props would work for one hop and break at the second;
 * duplicating it into both ViewModels produces two answers to one question.
 */
export class PlaygroundTodoStore extends ALankaSharedStore<IPlaygroundSelection> {
	constructor() {
		super(() => ({ selectedId: null }));
	}
}
