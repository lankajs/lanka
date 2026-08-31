/**
 * `@lankajs/host` — living inside somebody else's React framework.
 *
 * Next, React Router, TanStack Start, Astro, Expo. The host owns routing,
 * rendering and the request cache; this package owns the two places where lanka
 * has to meet it.
 *
 * **This entry is the browser half:** `hydrateLankaVM`, which makes data fetched
 * on the server the first state a screen reads.
 *
 * **`@lankajs/host/server` is the node half:** `runLankaRequest` and
 * `runLankaStatic`, which give one unit of server work its own framework
 * instance. It is a separate entry because it imports `node:async_hooks`, and a
 * client component must never resolve that.
 *
 * What this package deliberately does NOT add: a cache, a router, a renderer.
 * The host has all three, and a second answer to one question is a disagreement
 * the application ends up owning.
 */
export { hydrateLankaVM } from "./hydrate-lanka-vm/hydrateLankaVM";
