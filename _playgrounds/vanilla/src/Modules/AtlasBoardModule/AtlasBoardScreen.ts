import { bindAtlasVM } from "../../Core/Render/bindAtlasVM";
import { renderAtlasList } from "../../Core/Render/renderAtlasList";
import type { IAtlasBoardActions, IAtlasBoardState } from "@lanka-playgrounds/_shared";
import type { ILankaReadableVM } from "lanka/viewmodel";

/** What the board screen is given. */
export interface IAtlasBoardScreenConfig {
	boardVM: ILankaReadableVM<IAtlasBoardState & IAtlasBoardActions>;
	root: HTMLElement;
}

/**
 * The dispatch board: what the summary says, and what people are saying.
 *
 * The text being typed lives in a LOCAL variable here rather than in the
 * ViewModel, and the rule behind that is the same one the React screen states: a
 * ViewModel holds a screen's state, and a half-typed message is not state
 * anybody else needs.
 */
export const atlasBoardScreen = ({ boardVM, root }: IAtlasBoardScreenConfig): (() => void) => {
	const summary = document.createElement("p");
	summary.dataset.testid = "board-summary";

	const messages = document.createElement("ul");
	messages.dataset.testid = "board-messages";

	root.append(summary, messages);

	return bindAtlasVM(boardVM, (state) => {
		summary.textContent =
			state.error ??
			(state.summary ? `${String(state.summary.queued)} queued` : "no summary");
		renderAtlasList(messages, state.messages, (message) => message.text);
	});
};
