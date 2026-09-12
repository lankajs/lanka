/**
 * @lankajs/tanstack-query — TanStack Query behind the framework's read-cache port.
 *
 * ## When to install it, and when not to
 *
 * lanka ships no cache because a host framework carries one: Next, React Router
 * v7 and TanStack Start each have a request cache with revalidation, and a
 * second one disagrees with theirs on the first mutation. Where there is no host
 * — a plain Vite SPA — the slot is EMPTY rather than taken, and two screens
 * reading one resource send two requests and grow two independently ageing
 * copies. That is the case this fills, and the only one.
 *
 * ## Why a package when an application could write these eighty lines
 *
 * Because three of them are wrong silently. Which cache event carries data,
 * which query an event is about, and whether an invalidation should refetch are
 * each a line whose mistake shows up as "sometimes it does not update" — the
 * class of bug nobody reproduces. They are written once here, with the reason
 * beside each.
 *
 * ## The recommended member of its family
 *
 * `modules/query/` holds one package per caching library. This is the one to
 * take unless there is a reason not to: of the libraries measured against the
 * port, it is the only one that implements all seven operations.
 * `@lankajs/nanostores-query` implements six and says which one it does not.
 */

export { LankaTanstackCache } from "./lanka-tanstack-cache/LankaTanstackCache";
export type { TLankaTanstackClient } from "./lanka-tanstack-cache/LankaTanstackCache";
export { createLankaTanstackCache } from "./_factories/create-lanka-tanstack-cache/createLankaTanstackCache";
