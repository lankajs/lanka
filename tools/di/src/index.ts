/**
 * `@lankajs/tool-di` — the consumer contract, and the bundler plugins that keep it.
 *
 * What lives HERE is what neither bundler owns: the contract itself, the
 * scaffolder and the verifier. The plugins are subpaths — `@lankajs/tool-di/vite`,
 * `/webpack`, `/turbopack`, `/rollup` and `/esbuild` — so a consumer imports the one their build uses
 * and never resolves a module written for the other.
 *
 * Kept out of `lanka`'s main barrel deliberately: everything here touches
 * `node:fs`, and a single stray import of it from application code would drag
 * the filesystem into a browser bundle. Separate entry points make that
 * impossible rather than merely discouraged.
 */
export { lankaDiSetup } from "./lanka-di-setup/lankaDiSetup";
export type { ILankaDiSetup } from "./lanka-di-setup/lankaDiSetup";
export { lankaDiScaffoldNotice } from "./lanka-di-scaffold-notice/lankaDiScaffoldNotice";
export { verifyLankaDi } from "./verify-lanka-di/verifyLankaDi";
export type { ILankaDiReport } from "./verify-lanka-di/verifyLankaDi";
export { lankaDiContract } from "./lanka-di-contract/lankaDiContract";
export type { ILankaBarrelSpec } from "./lanka-di-contract/lankaDiContract";
export type { ILankaDiPluginOptions } from "./_interfaces/ILankaDiPluginOptions";
