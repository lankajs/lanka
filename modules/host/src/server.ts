/**
 * `@lankajs/host/server` — the server half, behind its own subpath.
 *
 * A subpath rather than the root barrel because this file imports
 * `node:async_hooks`. The root of this package is browser code — a client
 * component calls `hydrateLankaVM` — and one entry carrying both would put a node
 * builtin in every browser bundle that tree-shaking failed to reach.
 *
 * Two names over one mechanism, because they differ in what may cross into them:
 * `runLankaRequest` carries the caller's identity, `runLankaStatic` refuses it.
 */
export { runLankaRequest } from "./run-lanka-request/runLankaRequest";
export type { TLankaRequestConfig } from "./run-lanka-request/runLankaRequest";
export { runLankaStatic } from "./run-lanka-static/runLankaStatic";
export type { TLankaStaticConfig } from "./run-lanka-static/runLankaStatic";
export type { TLankaIncomingHeaders } from "./_types/TLankaIncomingHeaders";
