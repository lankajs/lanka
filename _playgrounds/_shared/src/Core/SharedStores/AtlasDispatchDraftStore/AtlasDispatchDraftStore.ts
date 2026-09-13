import { ALankaSharedStore } from "lanka/viewmodel";

/** A dispatch being written, before anybody has saved it. */
export interface IAtlasDispatchDraft {
	title: string;
	priority: number;
	crewId: string | null;
	/** Which step the person is on: the two editors agree about this too. */
	step: 1 | 2;
}

/**
 * One draft, two editors.
 *
 * The reason this is a shared store and not a scenario: the two dispatch steps
 * CO-OWN one buffer, and a scenario carries something that happened. The test is
 * the past tense — "the crew was chosen" is a fact, "we are both editing this
 * draft" is not.
 *
 * The state lives once, here, and each step gets its own ViewModel over it with
 * its own actions. Passing the draft down as props works for one hop and breaks
 * at the second; duplicating it into both ViewModels produces two answers to one
 * question.
 */
export class AtlasDispatchDraftStore extends ALankaSharedStore<IAtlasDispatchDraft> {
	public constructor() {
		super(() => ({ title: "", priority: 3, crewId: null, step: 1 }));
	}
}
