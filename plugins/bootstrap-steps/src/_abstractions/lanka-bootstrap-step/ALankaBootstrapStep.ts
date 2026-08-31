import type { ILankaBootstrapStepConfig } from "../../_interfaces/ILankaBootstrapStepConfig";
import type { ILankaBootstrapOutcome } from "../../_interfaces/ILankaBootstrapOutcome";

/**
 * A start-up step, written as a class.
 *
 * The functional style is the config object the pipeline already takes — a name
 * and a `run`, which is what a step usually is. This is the same contract for a
 * step that carries something of its own: a gateway it was given, a counter of
 * attempts, a value the previous run left behind.
 *
 * `toConfig()` is what the pipeline receives, so nothing above knows which style
 * wrote the step.
 */
export abstract class ALankaBootstrapStep<TContext extends ILankaBootstrapOutcome> {
	/** Name for the log and for failure reports. */
	public abstract readonly name: string;

	/** The step itself: takes the context, answers it changed. */
	protected abstract run(context: TContext): TContext | Promise<TContext>;

	/**
	 * A failure here does not abort the pipeline. Off by default, as in the
	 * config: a step nobody marked optional is required.
	 */
	protected readonly optional: boolean = false;

	/** How long to wait for this step. Undefined means the pipeline's own limit. */
	protected readonly timeoutMs: number | undefined = undefined;

	/** What the pipeline takes. The one place the two styles meet. */
	public toConfig(): ILankaBootstrapStepConfig<TContext> {
		return {
			name: this.name,
			run: (context) => this.run(context),
			optional: this.optional,
			...(this.timeoutMs === undefined ? {} : { timeoutMs: this.timeoutMs }),
		};
	}
}
