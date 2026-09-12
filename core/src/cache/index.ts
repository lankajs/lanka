/**
 * The read-cache port, and no cache.
 *
 * A host framework carries a request cache and its revalidation, so the
 * framework ships none — two of them disagree on the first mutation. This
 * subsystem exists for the case where there is no host: the slot is empty rather
 * than taken, and an application fills it behind one name.
 *
 * Types only, deliberately. Core declares what a cache must DO and calls none:
 * a ViewModel holds one as a service, resolved by name from the locator, so the
 * screen above it never learns which library answered.
 *
 * Implementations: `@lankajs/tanstack-query`, `@lankajs/nanostores-query`, or an
 * application's own — the conformance suite in `@lankajs/tool-testing` is what
 * says whether one is correct.
 */

export type { ILankaReadCache } from "./_interfaces/ILankaReadCache";
export type { TLankaCacheKey } from "./_types/TLankaCacheKey";
