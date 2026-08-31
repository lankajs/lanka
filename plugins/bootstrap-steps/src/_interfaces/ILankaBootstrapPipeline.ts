import type { ILankaBootstrapOutcome } from "./ILankaBootstrapOutcome";

export interface ILankaBootstrapPipeline<TContext extends ILankaBootstrapOutcome> {
	/**
	 * Runs the pipeline ONCE per session.
	 *
	 * Concurrent calls share one promise: several routes call bootstrap at once,
	 * and two runs would mean two sign-ins, two analytics sends and two attempts
	 * to record one fact.
	 */
	run: () => Promise<TContext>;
	/** Clears the run memory. Required at the end of a session. */
	reset: () => void;
}
