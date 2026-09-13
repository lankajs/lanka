import { createSharedStoreLankaVM } from "lanka/viewmodel";
import type {
	AtlasDispatchDraftStore,
	IAtlasDispatchDraft,
} from "../../Core/SharedStores/AtlasDispatchDraftStore/AtlasDispatchDraftStore";

/** What the second dispatch step can do to the draft. */
export interface IAtlasCrewStepActions {
	chooseCrew: (crewId: string | null) => void;
	goBack: () => void;
	/** Everything the draft holds, for whoever sends it. */
	draft: () => IAtlasDispatchDraft;
}

/**
 * The second step of a dispatch — the same store, the other half of the actions.
 *
 * Written by CALLING, over the same store its sibling extends a class for. Two
 * styles, one store, one state: which is the whole claim, and it is only
 * checkable because both are here.
 */
export const createAtlasCrewStepVM = (store: AtlasDispatchDraftStore) =>
	createSharedStoreLankaVM<IAtlasDispatchDraft, IAtlasCrewStepActions, AtlasDispatchDraftStore>({
		name: "AtlasCrewStepVM",
		store,
		createActions: ({ set, getStore }) => ({
			chooseCrew: (crewId) => {
				set({ crewId });
			},
			goBack: () => {
				set({ step: 1 });
			},
			// `getStore`, not `get`: what a sender needs is the DRAFT, and `get`
			// would hand it the draft with this ViewModel's actions on top.
			draft: () => getStore(),
		}),
	});
