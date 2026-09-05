import {
	ALankaGraphqlGateway,
	type IALankaGraphqlGatewayConfig,
} from "../../_abstractions/lanka-graphql-gateway/ALankaGraphqlGateway";
import type { ILankaGraphqlGatewayContext } from "../../_interfaces/ILankaGraphqlGatewayContext";

/** What a GraphQL gateway is built from, whichever style builds it. */
export interface ILankaGraphqlGatewayConfig<
	TMethods extends object,
> extends IALankaGraphqlGatewayConfig {
	/** The operations this gateway offers, written over its own surface. */
	methods: (context: ILankaGraphqlGatewayContext) => TMethods;
}

/**
 * A GraphQL gateway, without writing a class.
 *
 * The bridge below is the whole mechanism, and it lives here rather than on the
 * base: the language reads `protected` from inside a deriving class body and
 * nowhere else, so a factory outside the hierarchy could only reach the public
 * half — the wrong one.
 *
 * One implementation: what comes back is built by a subclass of
 * `ALankaGraphqlGateway`, so a behaviour fix reaches both styles at once.
 */
export const createLankaGraphqlGateway = <TMethods extends object>(
	config: ILankaGraphqlGatewayConfig<TMethods>,
): TMethods => {
	class FunctionalGraphqlGateway extends ALankaGraphqlGateway {
		public build(): TMethods {
			return config.methods({
				query: (operation, options, mockHandler) =>
					this.query(operation, options, mockHandler),
				mutate: (operation, options, mockHandler) =>
					this.mutate(operation, options, mockHandler),
			});
		}
	}

	return new FunctionalGraphqlGateway(config).build();
};
