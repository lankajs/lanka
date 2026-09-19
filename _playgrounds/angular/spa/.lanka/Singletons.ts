/**
 * The singletons this application publishes to `lanka`.
 *
 * `AtlasSession` is NOT here: the locator builds a registered class with
 * no arguments, and that one is given a gateway. It is registered as an
 * INSTANCE at start-up instead, which is the shape for a singleton with a
 * dependency.
 */
export { AtlasClock } from "@lanka-playgrounds/_shared/di";
