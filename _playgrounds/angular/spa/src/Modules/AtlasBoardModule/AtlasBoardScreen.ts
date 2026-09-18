import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { useLankaVM } from "@lankajs/angular";
import { ATLAS_BOARD_VM } from "./atlasBoardVM";

/**
 * The dispatch board: what the summary says, and what people are saying.
 *
 * It reads the binding's shared name rather than a helper of its own, because
 * there is nothing here two Angular hosts would share — and a helper with one
 * caller is a layer with no reason.
 */
@Component({
	selector: "atlas-board-screen",
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<section aria-label="Board">
			<p data-testid="board-summary">{{ summaryLine() }}</p>
			<ul data-testid="board-messages">
				@for (message of board().messages; track message.at) {
					<li>{{ message.text }}</li>
				}
			</ul>
		</section>
	`,
})
export class AtlasBoardScreen {
	readonly board = useLankaVM(inject(ATLAS_BOARD_VM));

	/**
	 * One method rather than three conditions in the template.
	 *
	 * Angular templates have no `??` chain that reads well across three cases, and
	 * a component that spelled this inline would repeat `board()` four times —
	 * each of which is a signal read, and each of which a reader has to check is
	 * the same one.
	 */
	summaryLine(): string {
		const state = this.board();

		return state.error ?? (state.summary ? `${state.summary.queued} queued` : "no summary");
	}
}
