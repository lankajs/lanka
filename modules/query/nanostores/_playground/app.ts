/**
 * A detail screen that hears a change made elsewhere, and says so rather than
 * overwriting what somebody is reading.
 *
 * The family shows its members in different consumer shapes on purpose:
 * `@lankajs/tanstack-query` carries a list with a second reader and an
 * optimistic rename. What the two share is asserted by the conformance suite, so
 * a second copy of one scene would teach nothing — and `check:composition` would
 * name the copy for what it is.
 */
export { startPlayground } from "./start-playground/startPlayground";
export type { IPlaygroundApp } from "./start-playground/startPlayground";
export { createPlaygroundTransport } from "./_testing/create-playground-transport/createPlaygroundTransport";
export type { IPlaygroundTransport } from "./_testing/create-playground-transport/createPlaygroundTransport";
export { createPlaygroundArticleVM } from "./create-playground-article-vm/createPlaygroundArticleVM";
export { PlaygroundArticleGateway } from "./playground-article-gateway/PlaygroundArticleGateway";
export type { IPlaygroundArticle } from "./_interfaces/IPlaygroundArticle";
