import { ALankaSharedStoreVM } from "lanka/viewmodel";
import type {
	AtlasDispatchDraftStore,
	IAtlasDispatchDraft,
} from "../../Core/SharedStores/AtlasDispatchDraftStore/AtlasDispatchDraftStore";

/** What the first dispatch step can do to the draft. */
export interface IAtlasDispatchStepActions {
	setTitle: (title: string) => void;
	setPriority: (priority: number) => void;
	goToCrewStep: () => void;
}

/**
 * The first step of a dispatch, over a draft it shares with the second.
 *
 * Each step owns its ACTIONS; the STATE lives once, in the store. Two readers
 * cannot then drift apart — which passing the draft down as props survives for
 * exactly one hop, and duplicating it into both ViewModels never survives at
 * all: two answers to one question, and whichever wrote last wins.
 *
 * Written as a class; its sibling below is written by calling.
 */
export class AtlasDispatchStepVM extends ALankaSharedStoreVM<
	IAtlasDispatchDraft,
	IAtlasDispatchStepActions,
	AtlasDispatchDraftStore
> {
	protected readonly name = "AtlasDispatchStepVM";

	protected createActions(): IAtlasDispatchStepActions {
		return {
			setTitle: (title) => {
				this.set({ title });
			},
			setPriority: (priority) => {
				this.set({ priority });
			},
			goToCrewStep: () => {
				this.set({ step: 2 });
			},
		};
	}
}
