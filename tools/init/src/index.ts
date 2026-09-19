/**
 * `@lankajs/tool-init` — the first command a project runs.
 *
 * It answers one question — "I have a project; what does wiring lanka into it
 * actually involve?" — by doing it: the barrels, the alias in whichever build
 * this project has, the `tsconfig` paths, the packages the answers imply, and
 * one feature written through every layer so that the layers are a thing a
 * reader can see rather than a thing a guide describes.
 *
 * It does not create the application. `create-vite`, `create-next-app` and
 * `create-expo-app` exist and are better at it; what this writes is the part
 * they cannot know about.
 *
 * The command is `runLankaInitCli`. Everything under it is published too,
 * because the three steps are useful apart: `lankaInitCatalog` is what there is,
 * `planLankaInit` turns a set of answers into packages and files without
 * touching anything, and `applyLankaInit` is the only part that meets a disk.
 */
export { runLankaInitCli } from "./run-lanka-init-cli/runLankaInitCli";
export type { IRunLankaInitCliOptions } from "./run-lanka-init-cli/runLankaInitCli";
export { lankaInitCatalog } from "./lanka-init-catalog/lankaInitCatalog";
export { planLankaInit } from "./plan-lanka-init/planLankaInit";
export { applyLankaInit } from "./apply-lanka-init/applyLankaInit";
export type { IApplyLankaInitOptions } from "./apply-lanka-init/applyLankaInit";
export { lankaNodeInitHost } from "./_adapters/lanka-node-init-host/lankaNodeInitHost";
export type { ILankaInitAnswer } from "./_interfaces/ILankaInitAnswer";
export type { ILankaInitChoices } from "./_interfaces/ILankaInitChoices";
export type { ILankaInitDependency } from "./_interfaces/ILankaInitDependency";
export type { ILankaInitFile } from "./_interfaces/ILankaInitFile";
export type { ILankaInitHost } from "./_interfaces/ILankaInitHost";
export type { ILankaInitNote } from "./_interfaces/ILankaInitNote";
export type {
	ILankaInitInstall,
	ILankaInitKept,
	ILankaInitOutcome,
	ILankaInitWritten,
} from "./_interfaces/ILankaInitOutcome";
export type { ILankaInitPlan } from "./_interfaces/ILankaInitPlan";
export type { ILankaInitLabel, ILankaInitQuestion } from "./_interfaces/ILankaInitQuestion";
export type {
	ILankaInitTemplate,
	TLankaInitBuild,
	TLankaInitFramework,
} from "./_interfaces/ILankaInitTemplate";
export type { TLankaInitRuntime } from "./_types/TLankaInitRuntime";
