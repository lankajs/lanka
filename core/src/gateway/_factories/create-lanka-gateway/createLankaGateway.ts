import { ALankaGateway } from "../../_abstractions/lanka-gateway/ALankaGateway";
import type { IALankaGatewayConfig } from "../../_interfaces/IALankaGatewayConfig";
import type { ILankaGatewayContext } from "../../_interfaces/ILankaGatewayContext";

/** What a gateway is built from, whichever style builds it. */
export interface ILankaGatewayConfig<
	TOptions,
	TMethods extends object,
> extends IALankaGatewayConfig<TOptions> {
	/** The endpoints this gateway offers, written over its own surface. */
	methods: (context: ILankaGatewayContext<TOptions>) => TMethods;
}

/**
 * A gateway, without writing a class.
 *
 * The bridge below is the whole mechanism, and it lives here rather than on the
 * base for two reasons. The language reads `protected` from inside a deriving
 * class body and nowhere else, so a factory outside the hierarchy could only
 * reach the public half — the wrong one. And a `toStyleContext` ON the base
 * would put `TOptions` in a method's parameter position, making the class
 * invariant in it: every `ALankaGateway<unknown>` the locator holds would stop
 * accepting a gateway typed for `RequestInit`.
 *
 * One implementation: what comes back is an instance of `ALankaGateway`, so a
 * behaviour fix reaches both styles at once.
 */
export const createLankaGateway = <TOptions, TMethods extends object>(
	config: ILankaGatewayConfig<TOptions, TMethods>,
): TMethods => {
	class FunctionalGateway extends ALankaGateway<TOptions> {
		// The base keeps a protected constructor — it is abstract, and a consumer
		// reaching for `new ALankaGateway()` would get an object with no endpoints.
		// A subclass may widen it, and this one is the subclass.
		public constructor(gatewayConfig: IALankaGatewayConfig<TOptions>) {
			super(gatewayConfig);
		}

		public build(): TMethods {
			return config.methods({
				endpoint: (path) => this.endpoint(path),
				request: (path, options, mockHandler) => this.request(path, options, mockHandler),
				buildQueryParams: (params) => this.buildQueryParams(params),
				validationService: this.validationService,
			});
		}
	}

	return new FunctionalGateway(config).build();
};
