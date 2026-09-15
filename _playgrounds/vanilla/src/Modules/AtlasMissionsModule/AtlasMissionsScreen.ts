import { bindAtlasVM } from "../../Core/Render/bindAtlasVM";
import { renderAtlasList } from "../../Core/Render/renderAtlasList";
import type { IAtlasMissionsActions, IAtlasMissionsState } from "@lanka-playgrounds/_shared";
import type { ILankaReadableVM } from "lanka/viewmodel";

/** What the missions screen is given: a ViewModel, and somewhere to paint. */
export interface IAtlasMissionsScreenConfig {
	missionsVM: ILankaReadableVM<IAtlasMissionsState & IAtlasMissionsActions>;
	root: HTMLElement;
}

/**
 * The missions screen, written in the DOM.
 *
 * It reads ONE ViewModel and owns nothing: no loading flag of its own, no retry,
 * no decision about what a failure means. Every one of those belongs to the
 * ViewModel — the same sentence `_playgrounds/react`'s screen carries, about the
 * same ViewModel, with no framework between them.
 *
 * `rows()` is a DERIVED read: it looks at `missions`, `search`, `sort` and `page`
 * through the ViewModel's own `get`, which is why that ViewModel sets
 * `enableAccessTrackingOptimization: false`. Here it costs nothing to honour —
 * this screen repaints on every change by construction — and that is worth
 * noticing: the flag exists for BINDINGS, and an application without one never
 * meets the blind spot at all.
 */
export const atlasMissionsScreen = ({
	missionsVM,
	root,
}: IAtlasMissionsScreenConfig): (() => void) => {
	const status = document.createElement("p");
	status.dataset.testid = "missions-status";

	const list = document.createElement("ul");
	list.dataset.testid = "missions";

	const search = document.createElement("input");
	search.setAttribute("aria-label", "search");
	search.addEventListener("input", () => {
		missionsVM.getState().applySearch(search.value);
	});

	root.append(search, status, list);

	return bindAtlasVM(missionsVM, (state) => {
		status.textContent =
			state.error ?? (state.isLoading ? "loading" : `page ${String(state.page)}`);
		renderAtlasList(list, state.rows().items, (mission) => mission.title);
	});
};
