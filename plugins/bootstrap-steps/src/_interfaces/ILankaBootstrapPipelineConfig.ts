import type { ILankaBootstrapOutcome } from "./ILankaBootstrapOutcome";
import type { ILankaBootstrapStepConfig } from "./ILankaBootstrapStepConfig";

export interface ILankaBootstrapPipelineConfig<TContext extends ILankaBootstrapOutcome> {
	/** Initial context. A function, not a value: a repeat run starts clean. */
	createContext: () => TContext;
	steps: readonly ILankaBootstrapStepConfig<TContext>[];
	report?: (message: string) => void;
}
