/**
 * Two screens reading one resource, which is the whole reason this package
 * exists.
 *
 * The family shows its members in different consumer shapes on purpose: this one
 * is a LIST with a second reader over it and an optimistic rename, and
 * `@lankajs/nanostores-query` is a detail screen hearing a change made
 * elsewhere. Two playgrounds teaching two things rather than one thing twice —
 * and the assertions they share come from the conformance suite, not from a
 * copy.
 */
export { startPlayground } from "./start-playground/startPlayground";
export type { IPlaygroundApp } from "./start-playground/startPlayground";
export { createPlaygroundTransport } from "./_testing/create-playground-transport/createPlaygroundTransport";
export type { IPlaygroundTransport } from "./_testing/create-playground-transport/createPlaygroundTransport";
export { createPlaygroundOrdersVM } from "./create-playground-orders-vm/createPlaygroundOrdersVM";
export { PlaygroundOrderGateway } from "./playground-order-gateway/PlaygroundOrderGateway";
export type { IPlaygroundOrder } from "./_interfaces/IPlaygroundOrder";
