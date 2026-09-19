/**
 * Half of this application's gateways — the shard.
 *
 * `.lanka/Gateways.ts` holds the other half and re-exports this file, so the
 * framework reads one namespace built from two. Which gateway is on which side
 * means nothing to lanka: the split is here to keep the two-directory layout
 * proved by a real application rather than only by a unit test, and a team doing
 * this for real would split on something they care about.
 *
 * The one rule a shard has: a name exported from both sides is dropped by the
 * star re-export that joins them, silently. `verifyLankaDi` reports it, and the
 * scene in `src/atlas-node.live.test.ts` is what runs that check here.
 */
export { AtlasSessionGateway } from "@lanka-playgrounds/_shared/di";
