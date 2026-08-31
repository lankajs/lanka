import type { ILankaBootstrapOutcome } from "../../_interfaces/ILankaBootstrapOutcome";
import type { ILankaBootstrapPipeline } from "../../_interfaces/ILankaBootstrapPipeline";
import type { ILankaBootstrapPipelineConfig } from "../../_interfaces/ILankaBootstrapPipelineConfig";
import type { ILankaBootstrapStepConfig } from "../../_interfaces/ILankaBootstrapStepConfig";

/**
 * A pipeline of bootstrap steps: context, early exit and a redirect target.
 *
 * ## Why this does not duplicate core's bootstrap
 *
 * Core runs a SET of services: each with a name, priority, sync flag, `optional`
 * and a deadline; they do not talk to each other.
 *
 * This is a CHAIN: a step reads what the previous one produced and may say "stop
 * here, send the user there". Core can only "run or throw", and an early exit
 * cannot be expressed that way — an exception would mean failure, and this is a
 * decision.
 *
 * `optional` and `timeoutMs` are therefore OURS, with the same meaning and the
 * same names: the executor differs, the questions the configuration answers do
 * not. Different words for one thing would force the reader to remember which of
 * the two they are in.
 */
export const createLankaBootstrapPipeline = <TContext extends ILankaBootstrapOutcome>(
	config: ILankaBootstrapPipelineConfig<TContext>,
): ILankaBootstrapPipeline<TContext> => {
	const report = config.report ?? (() => undefined);
	let settled: TContext | null = null;
	let inFlight: Promise<TContext> | null = null;

	const runStep = async (
		step: ILankaBootstrapStepConfig<TContext>,
		context: TContext,
	): Promise<TContext> => {
		try {
			return await withDeadline(step, context);
		} catch (error) {
			if (!step.optional) throw error;
			// The context is returned UNTOUCHED: a step that failed midway may have
			// written half its result, and continuing with that half is worse than
			// continuing without it.
			report(`step "${step.name}" skipped: ${describe(error)}`);
			return context;
		}
	};

	const runPipeline = async (): Promise<TContext> => {
		let context = config.createContext();

		for (const step of config.steps) {
			context = await runStep(step, context);
			if (context.done) {
				report(`pipeline stopped at "${step.name}"`);
				break;
			}
		}

		return context;
	};

	return {
		run(): Promise<TContext> {
			if (settled !== null) return Promise.resolve(settled);
			if (inFlight !== null) return inFlight;

			inFlight = runPipeline()
				.then((context) => {
					// Only a COMPLETED run is remembered. An early exit means "the user
					// is not signed in"; remembering it would strand the app on the
					// sign-in screen forever.
					if (!context.done) settled = context;
					return context;
				})
				.finally(() => {
					inFlight = null;
				});

			return inFlight;
		},
		reset(): void {
			settled = null;
			inFlight = null;
		},
	};
};

const describe = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

const withDeadline = <TContext>(
	step: ILankaBootstrapStepConfig<TContext>,
	context: TContext,
): Promise<TContext> => {
	const result = Promise.resolve(step.run(context));
	if (step.timeoutMs === undefined) return result;

	return new Promise<TContext>((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(
				new Error(`step "${step.name}" did not finish within ${String(step.timeoutMs)}ms`),
			);
		}, step.timeoutMs);

		result
			.then(resolve, reject)
			// The timer is ALWAYS cleared: left behind it holds the process and keeps
			// a passing test from finishing.
			.finally(() => {
				clearTimeout(timer);
			});
	});
};
