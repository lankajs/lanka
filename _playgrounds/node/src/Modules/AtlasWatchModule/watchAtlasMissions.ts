import type { IAtlasMissionsActions, IAtlasMissionsState } from "@lanka-playgrounds/_shared";
import type { ILankaReadableVM } from "lanka/viewmodel";

/** One thing that changed, as a line a log or a queue can carry. */
export interface IAtlasMissionChange {
	/** How many missions the ViewModel holds now. */
	count: number;
	/** The codes that were not there a moment ago. */
	arrived: readonly string[];
	/** The codes that have gone. */
	left: readonly string[];
}

export interface IAtlasWatchConfig {
	missionsVM: ILankaReadableVM<IAtlasMissionsState & IAtlasMissionsActions>;
	/** What to do with a change. A log line, a queue message, a webhook. */
	onChange: (change: IAtlasMissionChange) => void;
}

const codesOf = (state: IAtlasMissionsState): readonly string[] =>
	state.missions.map((mission) => mission.code);

/**
 * Watches a ViewModel from a process that will never render it.
 *
 * This is the whole of what a "binding" is, with the renderer taken out:
 * `subscribe`, a comparison, and something to do with the answer. The browser's
 * version calls `useSyncExternalStore` and the answer is a repaint; here the
 * answer is a line, and neither knows about the other.
 *
 * ## Why the previous state is a parameter
 *
 * `subscribe` hands both, and that is the port's doing rather than zustand's —
 * every binding on the shelf needs the pair to decide whether a change is worth
 * acting on, and a subscription that only carried the new state would make each
 * of them keep its own copy of the old one.
 *
 * ## No access tracking here, deliberately
 *
 * Tracking exists to SKIP work a renderer would otherwise do, and the work here
 * is a function call. Paying for a recording Proxy to avoid one would be the
 * optimisation costing more than the thing it avoids — and it is worth seeing
 * once: the blind spot the browser applications have to think about does not
 * exist in a consumer that reads everything.
 */
export const watchAtlasMissions = ({ missionsVM, onChange }: IAtlasWatchConfig): (() => void) =>
	missionsVM.subscribe((next, prev) => {
		const before = new Set(codesOf(prev));
		const after = new Set(codesOf(next));

		const arrived = codesOf(next).filter((code) => !before.has(code));
		const left = codesOf(prev).filter((code) => !after.has(code));

		if (arrived.length === 0 && left.length === 0) return;

		onChange({ count: next.missions.length, arrived, left });
	});
