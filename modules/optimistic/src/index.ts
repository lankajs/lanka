/**
 * @lankajs/optimistic — optimistic mutations with real request cancellation.
 *
 * A module, not a plugin: core calls nothing here. A ViewModel does, and the
 * abort signal reaches the gateway as an ordinary request parameter.
 *
 * Two strategies, differing in what counts as a failure: under `runLatest` a
 * superseding click justifies skipping the rollback; under `runExclusive` there
 * is no superseding click, so the rollback is always mandatory.
 */

export { LankaOptimisticActions } from "./lanka-optimistic-actions/LankaOptimisticActions";
export { createLankaOptimisticActions } from "./_factories/create-lanka-optimistic-actions/createLankaOptimisticActions";
export type { TLankaExclusiveOutcome } from "./lanka-optimistic-actions/LankaOptimisticActions";
