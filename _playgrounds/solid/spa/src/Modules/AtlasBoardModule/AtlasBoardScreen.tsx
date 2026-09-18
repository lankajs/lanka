import { For, onCleanup } from "solid-js";
import { useLankaVM } from "@lankajs/solid";
import type { AtlasBoardVM } from "@lanka-playgrounds/_shared";

/**
 * The dispatch board: what the summary says, and what people are saying.
 *
 * It reads the binding's shared name rather than a helper of its own, because
 * there is nothing here two Solid hosts would share — and a helper with one
 * caller is a layer with no reason.
 */
export const AtlasBoardScreen = (props: { boardVM: ReturnType<AtlasBoardVM["build"]> }) => {
	const board = useLankaVM(props.boardVM);

	onCleanup(() => {
		board.stop();
	});

	return (
		<section aria-label="Board">
			<p data-testid="board-summary">
				{board().error ??
					(board().summary ? `${board().summary?.queued} queued` : "no summary")}
			</p>
			<ul data-testid="board-messages">
				<For each={board().messages}>{(message) => <li>{message.text}</li>}</For>
			</ul>
		</section>
	);
};
