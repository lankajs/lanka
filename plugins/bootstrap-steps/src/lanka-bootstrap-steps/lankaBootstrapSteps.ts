import type { ILankaPlugin } from "lanka";
import { createLankaBootstrapPipeline } from "../_factories/create-lanka-bootstrap-pipeline/createLankaBootstrapPipeline";
import type { ILankaBootstrapOutcome } from "../_interfaces/ILankaBootstrapOutcome";
import type { ILankaBootstrapPipeline } from "../_interfaces/ILankaBootstrapPipeline";
import type { ILankaBootstrapPipelineConfig } from "../_interfaces/ILankaBootstrapPipelineConfig";

/**
 * The plugin that owns the pipeline's lifetime.
 *
 * Disposing the instance clears the run memory: otherwise the next instance — a
 * test beside the app, a dev module reload — would consider bootstrap done.
 */
export const lankaBootstrapSteps = <TContext extends ILankaBootstrapOutcome>(
	config: ILankaBootstrapPipelineConfig<TContext>,
): ILankaPlugin & { readonly pipeline: ILankaBootstrapPipeline<TContext> } => {
	const pipeline = createLankaBootstrapPipeline(config);

	return {
		name: "@lankajs/plugin-bootstrap-steps",
		pipeline,
		install() {
			return () => {
				pipeline.reset();
			};
		},
	};
};
