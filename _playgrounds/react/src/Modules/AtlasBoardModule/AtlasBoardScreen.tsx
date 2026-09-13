import { useEffect, useState } from "react";
import type { AtlasBoardChannel } from "../../Gateways/AtlasBoardChannel/AtlasBoardChannel";
import type { IAtlasBoardActions, IAtlasBoardState } from "@lanka-playgrounds/_shared";
import type { JSX } from "react";
import type { StoreApi, UseBoundStore } from "zustand";

export interface IAtlasBoardScreenProps {
	useBoardVM: UseBoundStore<StoreApi<IAtlasBoardState & IAtlasBoardActions>>;
	channel: AtlasBoardChannel;
}

/**
 * The dispatch board: what the summary says, and what people are saying.
 *
 * The text being typed lives in `useState` HERE rather than in the ViewModel,
 * and the rule behind that is worth knowing: a ViewModel holds a screen's state,
 * and a half-typed message is not state anybody else needs. It also makes this
 * component work unchanged under server rendering, where a module-level store is
 * one store shared by every request.
 */
export const AtlasBoardScreen = ({ useBoardVM, channel }: IAtlasBoardScreenProps): JSX.Element => {
	const { summary, messages, error, fetchSummary } = useBoardVM();
	const [draft, setDraft] = useState("");

	useEffect(() => {
		void fetchSummary();
	}, [fetchSummary]);

	const say = (): void => {
		if (draft.trim().length === 0) return;
		// The channel answers whether it went out NOW; `false` means it was held
		// for the next connection, which for a board message is fine.
		channel.say(draft.trim());
		setDraft("");
	};

	return (
		<section aria-label="Board">
			{error !== null && <p role="alert">{error}</p>}

			<p data-testid="summary">
				{summary === null
					? "no summary yet"
					: `${summary.queued} queued, ${summary.active} active`}
			</p>

			<ul aria-label="Messages">
				{messages.map((message) => (
					<li key={`${message.at}-${message.text}`}>{message.text}</li>
				))}
			</ul>

			<input
				aria-label="Say something"
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
			/>
			<button type="button" onClick={say}>
				Say
			</button>
		</section>
	);
};
