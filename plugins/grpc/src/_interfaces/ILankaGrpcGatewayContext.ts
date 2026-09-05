import type { TLankaExecuteOptions } from "lanka/gateway";
import type { ILankaGrpcMethod } from "./ILankaGrpcMethod";

/**
 * A gRPC gateway's protected surface, handed to whoever builds one by calling.
 *
 * The name matches `ALankaGrpcGateway`'s protected member exactly, and that is
 * the parity contract: a consumer who switches styles moves the same call from
 * `this.unary(...)` to `unary(...)` and changes nothing else. Checked by
 * `scripts/check-parity.mjs`.
 */
export interface ILankaGrpcGatewayContext {
	/** One request, one response. */
	unary: <TRequest, TResponse>(
		method: ILankaGrpcMethod<TRequest, TResponse>,
		message: TRequest,
		options?: TLankaExecuteOptions<RequestInit>,
		mockHandler?: () => Promise<TResponse>,
	) => Promise<TResponse>;
}
