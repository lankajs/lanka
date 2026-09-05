import { LankaGraphqlSubscriptionTransport } from "../../lanka-graphql-subscription-transport/LankaGraphqlSubscriptionTransport";
import type { ILankaGraphqlSubscriptionConfig } from "../../lanka-graphql-subscription-transport/LankaGraphqlSubscriptionTransport";

/**
 * The functional style of `LankaGraphqlSubscriptionTransport`: the connection an
 * application builds itself and hands to the plugin.
 *
 * One line, and that is the point — the factory IS the class, so a behaviour
 * cannot exist in one style and not the other. Canon: `skills/parity/SKILL.md`.
 */
export const createLankaGraphqlSubscriptionTransport = (
	config: ILankaGraphqlSubscriptionConfig = {},
): LankaGraphqlSubscriptionTransport => new LankaGraphqlSubscriptionTransport(config);
