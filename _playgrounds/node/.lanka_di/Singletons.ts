/**
 * The singletons this application publishes to `lanka` — all of them.
 *
 * The other kind of split: this barrel is not sharded, it simply LIVES here,
 * and `.lanka/Singletons.ts` is the one line that says so. A project dividing
 * its wiring by abstraction rather than by shard looks like this.
 */
export { AtlasClock } from "@lanka-playgrounds/_shared/di";
