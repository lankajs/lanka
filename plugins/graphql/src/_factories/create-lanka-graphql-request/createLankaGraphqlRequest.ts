import { LankaGraphqlRequest } from "../../lanka-graphql-request/LankaGraphqlRequest";
import type { ILankaGraphqlRequestConfig } from "../../lanka-graphql-request/LankaGraphqlRequest";

/**
 * The functional style of `LankaGraphqlRequest`: the request kind an application
 * hands to a gateway it already has.
 *
 * One line, and that is the point — the factory IS the class, so a behaviour
 * cannot exist in one style and not the other. Canon: `skills/parity/SKILL.md`.
 */
export const createLankaGraphqlRequest = <TOptions = RequestInit>(
	config: ILankaGraphqlRequestConfig<TOptions> = {},
): LankaGraphqlRequest<TOptions> => new LankaGraphqlRequest<TOptions>(config);
