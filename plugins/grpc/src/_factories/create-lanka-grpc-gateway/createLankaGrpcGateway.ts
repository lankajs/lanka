import {
	ALankaGrpcGateway,
	type IALankaGrpcGatewayConfig,
} from "../../_abstractions/lanka-grpc-gateway/ALankaGrpcGateway";
import type { ILankaGrpcGatewayContext } from "../../_interfaces/ILankaGrpcGatewayContext";

/** What a gRPC gateway is built from, whichever style builds it. */
export interface ILankaGrpcGatewayConfig<TMethods extends object> extends IALankaGrpcGatewayConfig {
	/** The calls this gateway offers, written over its own surface. */
	methods: (context: ILankaGrpcGatewayContext) => TMethods;
}

/**
 * A gRPC gateway, without writing a class.
 *
 * The bridge below is the whole mechanism, and it lives here rather than on the
 * base: the language reads `protected` from inside a deriving class body and
 * nowhere else, so a factory outside the hierarchy could only reach the public
 * half — the wrong one.
 *
 * One implementation: what comes back is built by a subclass of
 * `ALankaGrpcGateway`, so a behaviour fix reaches both styles at once.
 */
export const createLankaGrpcGateway = <TMethods extends object>(
	config: ILankaGrpcGatewayConfig<TMethods>,
): TMethods => {
	class FunctionalGrpcGateway extends ALankaGrpcGateway {
		public build(): TMethods {
			return config.methods({
				unary: (method, message, options, mockHandler) =>
					this.unary(method, message, options, mockHandler),
			});
		}
	}

	return new FunctionalGrpcGateway(config).build();
};
