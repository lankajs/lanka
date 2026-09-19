import { For } from "solid-js";
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

	/*
	 * No `onCleanup(() => board.stop())`, and that is the correction rather
	 * than an omission. `useLankaVM` registers `onCleanup(stop)` itself whenever
	 * it has an owner, which inside a component it always does — so a screen
	 * releasing as well released TWICE, and the playground's own leak scene is
	 * what said so, by counting one more unsubscribe than subscribe.
	 *
	 * It was harmless, because a second release is ignored. It was also the shape
	 * a reader copies, and the published `stop` exists for the other case: a read
	 * started OUTSIDE a component or a root, where there is no owner and nothing
	 * would ever call it.
	 */
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
