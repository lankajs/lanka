import type { ILankaSortState } from "@lankajs/collection";
import type { IAtlasMission } from "./IAtlasMission";

/**
 * What the missions screen holds.
 *
 * Flat keys, deliberately. The ViewModel hook tracks the state's ROOT keys, so a
 * component reading `search` re-renders when `search` moves and not when `page`
 * does. One `filters: { search, page }` object would make every keystroke
 * everybody's — which is exactly the cost a form library exists to remove, and
 * here it is avoided for free.
 */
export interface IAtlasMissionsState {
	missions: readonly IAtlasMission[];
	search: string;
	sort: ILankaSortState;
	page: number;
	isLoading: boolean;
	error: string | null;
	/** How many refreshes a burst of server events actually cost. */
	refreshes: number;
}
