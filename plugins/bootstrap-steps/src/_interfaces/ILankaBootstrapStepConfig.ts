import type { TLankaBootstrapStep } from "../_types/TLankaBootstrapStep";

export interface ILankaBootstrapStepConfig<TContext> {
	/** Name for the log and for failure reports. */
	name: string;
	run: TLankaBootstrapStep<TContext>;
	/**
	 * A failure of this step does not abort the pipeline: the context continues
	 * untouched.
	 *
	 * Same word and same meaning as for core's bootstrap services. Analytics
	 * failing at startup must not take sign-in down with it.
	 */
	optional?: boolean;
	/**
	 * How long to wait for the step. Overrunning counts as a failure.
	 *
	 * Without a deadline a step that never settles holds bootstrap forever and the
	 * app never paints its first screen. Failing is more honest than waiting.
	 */
	timeoutMs?: number;
}
