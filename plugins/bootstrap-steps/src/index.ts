/**
 * @lankajs/plugin-bootstrap-steps — bootstrap as a chain of steps.
 *
 * A plugin, not a module: the pipeline lives exactly as long as the framework
 * instance, and disposing the instance must clear its run memory.
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
 */

export { ALankaBootstrapStep } from "./_abstractions/lanka-bootstrap-step/ALankaBootstrapStep";
export { createLankaBootstrapPipeline } from "./_factories/create-lanka-bootstrap-pipeline/createLankaBootstrapPipeline";
export { lankaBootstrapSteps } from "./lanka-bootstrap-steps/lankaBootstrapSteps";
export type { TLankaBootstrapStep } from "./_types/TLankaBootstrapStep";
export type { ILankaBootstrapStepConfig } from "./_interfaces/ILankaBootstrapStepConfig";
export type { ILankaBootstrapOutcome } from "./_interfaces/ILankaBootstrapOutcome";
export type { ILankaBootstrapPipelineConfig } from "./_interfaces/ILankaBootstrapPipelineConfig";
export type { ILankaBootstrapPipeline } from "./_interfaces/ILankaBootstrapPipeline";
