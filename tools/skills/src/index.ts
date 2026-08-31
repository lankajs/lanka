/**
 * @lankajs/tool-skills — the agent skills of the packages you installed, in your
 * project.
 *
 * The command is `lanka-skills sync`. What is exported here is for a project
 * that would rather run it from a script of its own: every decision is a
 * function over a file-system port, so the same code answers "what would happen"
 * without writing anything.
 */

export { findLankaSkillSources } from "./find-lanka-skill-sources/findLankaSkillSources";
export { lankaNodeSkillHost } from "./_adapters/lanka-node-skill-host/lankaNodeSkillHost";
export { lankaSkillMarker } from "./lanka-skill-marker/lankaSkillMarker";
export { lankaDefaultSkillTarget } from "./lanka-default-skill-target/lankaDefaultSkillTarget";
export { planLankaSkillSync } from "./plan-lanka-skill-sync/planLankaSkillSync";
export { syncLankaSkills } from "./sync-lanka-skills/syncLankaSkills";
// The help text is deliberately NOT exported: it is what the command prints, not
// something a consumer builds on, and a promise nobody asked for is one this
// package would have to keep until a major.
export { runLankaSkillsCli } from "./run-lanka-skills-cli/runLankaSkillsCli";

export type { IFindLankaSkillSourcesOptions } from "./find-lanka-skill-sources/findLankaSkillSources";
export type { ILankaSkillHost } from "./_interfaces/ILankaSkillHost";
export type { ILankaSkillSource } from "./_interfaces/ILankaSkillSource";
export type { ILankaSkillSyncPlan } from "./_interfaces/ILankaSkillSyncPlan";
export type { IPlanLankaSkillSyncOptions } from "./plan-lanka-skill-sync/planLankaSkillSync";
export type { IRunLankaSkillsCliOptions } from "./run-lanka-skills-cli/runLankaSkillsCli";
export type { ISyncLankaSkillsOptions } from "./sync-lanka-skills/syncLankaSkills";
