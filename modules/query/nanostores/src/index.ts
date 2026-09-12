/**
 * @lankajs/nanostores-query — nanostores behind the framework's read-cache port.
 *
 * ## Take `@lankajs/tanstack-query` unless this reason applies
 *
 * Both bind `ILankaReadCache`, so the ViewModels above them are identical and an
 * application swaps one for the other by changing which is installed. TanStack
 * Query implements all seven operations; this implements six. Take this one when
 * the application ALREADY uses nanostores for its own state — then it is one
 * cache rather than two, and one subscription model rather than two.
 *
 * ## What it cannot do, said plainly
 *
 * `cancel` is absent. `@nanostores/query` declares its fetcher as
 * `(...keyParts) => Promise<T>`, so no `AbortSignal` reaches the loader at all.
 * The port makes `cancel` optional for exactly this case, and a caller reads its
 * absence as "the request finishes and its answer is discarded" — wasteful,
 * never wrong. Declaring a no-op instead would be worse: a ViewModel would
 * believe the request stopped.
 *
 * ## When to install neither
 *
 * Where a host framework already carries a request cache — Next, React Router
 * v7, TanStack Start — a second one disagrees with it on the first mutation.
 * This family is for the case where the slot is EMPTY, not where it is taken.
 */

export { LankaNanostoresCache } from "./lanka-nanostores-cache/LankaNanostoresCache";
export type { TLankaNanostoresClient } from "./lanka-nanostores-cache/LankaNanostoresCache";
export { createLankaNanostoresCache } from "./_factories/create-lanka-nanostores-cache/createLankaNanostoresCache";
