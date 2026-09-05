import type { ILankaDevtoolsSnapshot } from "../../../collector/LankaDevtoolsCollector";

/** Which of the four lists the panel is showing. */
export type TLankaDevtoolsPanelTab = "events" | "logs" | "requests" | "scenarios";

/** One line of the panel. */
export interface ILankaDevtoolsPanelRow {
	text: string;
	/** `bad` is a stop or a failure; `quiet` is something that never happened. */
	tone?: "bad" | "quiet";
}

/**
 * A snapshot, as lines.
 *
 * Kept apart from the DOM for the reason every rendering decision here is: what
 * the panel SAYS is the part worth testing, and a test that had to mount a
 * document to read it would assert on element trees instead of on sentences.
 *
 * Newest first everywhere it is a history: an inspector is read when something
 * has just happened.
 */
export const lankaDevtoolsPanelRows = (
	snapshot: ILankaDevtoolsSnapshot,
	tab: TLankaDevtoolsPanelTab,
	filter = "",
): readonly ILankaDevtoolsPanelRow[] => {
	const needle = filter.trim().toLowerCase();
	const rows = ROWS_BY_TAB[tab](snapshot);

	if (needle === "") return rows;

	return rows.filter((row) => row.text.toLowerCase().includes(needle));
};

/**
 * One builder per tab, in a table.
 *
 * A table rather than a chain of branches: a fifth list is then an entry, and
 * `skills/composition/SKILL.md` §2 is the reason.
 */
const ROWS_BY_TAB: Record<
	TLankaDevtoolsPanelTab,
	(snapshot: ILankaDevtoolsSnapshot) => readonly ILankaDevtoolsPanelRow[]
> = {
	events: (snapshot) =>
		[...snapshot.events].reverse().map((event) => ({
			text:
				`${event.eventType} → ${String(event.subscribers)}` +
				(event.outcome === "delivered" ? "" : ` [${event.outcome}]`) +
				(event.stoppedBy === undefined ? "" : ` ${event.stoppedBy}`),
			tone: event.outcome === "delivered" ? undefined : ("bad" as const),
		})),

	logs: (snapshot) =>
		[...snapshot.logs].reverse().map((line) => ({
			text: `${line.layer} ${line.message}`,
			tone: line.level === "error" || line.level === "warn" ? ("bad" as const) : undefined,
		})),

	requests: (snapshot) =>
		[...snapshot.requests].reverse().map((request) => ({
			text:
				`${request.endpoint} · ${String(request.durationMs)}ms` +
				(request.error === undefined ? "" : ` · ${request.error}`),
			tone: request.outcome === "failed" ? ("bad" as const) : undefined,
		})),

	// Not reversed: this one is a REGISTER rather than a history, and a register
	// that reordered itself as things happened could not be read down.
	scenarios: (snapshot) =>
		snapshot.scenarios.map((scenario) => ({
			text: `${scenario.eventType} · ${String(scenario.subscribers)} subs · ${String(scenario.dispatches)}×`,
			// The answer to "why did nothing happen": nobody is listening, or it has
			// never been fired. Both are invisible in a list of what DID happen.
			tone:
				scenario.subscribers === 0 || scenario.dispatches === 0
					? ("quiet" as const)
					: undefined,
		})),
};
