import type { ILankaEventBusOutcome } from "../_interfaces/ILankaEventBusOutcome";

/**
 * Something watching what became of each dispatch.
 *
 * ## Why this is not a middleware
 *
 * A middleware runs in a CHAIN and sees only what happened before it. The first
 * one registered — which is what a diagnostic tool ends up being, since it is
 * installed at bootstrap — cannot see a later middleware's decision to stop an
 * event, so "which middleware stopped it" was a question nothing could answer.
 * `@lankajs/plugin-devtools` carried a `stoppedBy` field that no code path ever
 * filled, and its guide documented it.
 *
 * An observer runs ONCE per dispatch, after the chain, and its return value is
 * ignored — it cannot decide anything. That is what keeps a diagnostic tool
 * incapable of changing what it diagnoses, by construction rather than by
 * discipline.
 *
 * ## Why the parameter is one object
 *
 * `skills/surface/SKILL.md` §6d.9: a callback's parameters are one object, so
 * the day the bus learns to report how long delivery took, nobody's handler
 * silently receives a different third argument.
 */
export type TLankaEventBusObserver = (outcome: ILankaEventBusOutcome) => void;
