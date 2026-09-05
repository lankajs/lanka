import { ALankaGateway, type IALankaGatewayConfig, type TLankaExecuteOptions } from "lanka/gateway";
import { LankaGrpcRequest } from "../../lanka-grpc-request/LankaGrpcRequest";
import { encodeLengthPrefixed } from "../../_internal/encode-length-prefixed/encodeLengthPrefixed";
import type { ILankaGrpcMethod } from "../../_interfaces/ILankaGrpcMethod";

/** What a gRPC gateway is built from, whichever style builds it. */
export interface IALankaGrpcGatewayConfig extends IALankaGatewayConfig<RequestInit> {
	/**
	 * Prefix for every method path. Empty by default.
	 *
	 * A gRPC path is already absolute — `/package.Service/Method` — so this is for
	 * a deployment that mounts the whole service under something, not for naming
	 * the service.
	 */
	basePath?: string;
	/** The content type. `application/grpc-web+proto` unless a codec says otherwise. */
	contentType?: string;
}

/**
 * A gateway that talks gRPC-Web.
 *
 * ## Where the codec meets the framing
 *
 * `LankaGrpcRequest` owns the wire — framing, trailers, the status — and knows
 * nothing about messages. A method knows its codec. This class is the one place
 * the two are put together, which is why `unary` takes the method rather than
 * the gateway being constructed with one: a service has many RPCs and they do
 * not share a message type.
 *
 * ## Mock mode short-circuits here, and that is worth knowing
 *
 * A mock handler answers a RESPONSE message, and a codec encodes REQUESTS — it
 * has no way to produce response bytes, so there is nothing for the wire path to
 * decode. The mock is therefore answered before the request kind is reached,
 * which makes this the one place in the package where the mock path and the real
 * path diverge: a mock cannot catch a codec that decodes wrongly, and a
 * development run against mocks proves nothing about the `.proto`.
 *
 * ## Writing one
 *
 * ```ts
 * class TodoGateway extends ALankaGrpcGateway {
 *   public list(request: IListTodos) {
 *     return this.unary(LIST_TODOS, request);
 *   }
 * }
 * ```
 *
 * A subclass MUST implement nothing. It replaces the request kind through
 * `request` in the config — that is the seam a test uses.
 */
export abstract class ALankaGrpcGateway extends ALankaGateway<RequestInit> {
	private readonly contentType: string;

	// The constructor is PUBLIC: the class is abstract and cannot be constructed
	// on its own, while `protected` is inherited — and the application's subclass
	// would then be unreachable to the code that creates it.
	public constructor(config: IALankaGrpcGatewayConfig = {}) {
		super({ ...config, request: config.request ?? new LankaGrpcRequest() });
		this.contentType = config.contentType ?? "application/grpc-web+proto";
	}

	/** One request, one response. */
	protected unary<TRequest, TResponse>(
		method: ILankaGrpcMethod<TRequest, TResponse>,
		message: TRequest,
		options?: TLankaExecuteOptions<RequestInit>,
		mockHandler?: () => Promise<TResponse>,
	): Promise<TResponse> {
		if (this.useMock && mockHandler) return mockHandler();

		return this.request<Uint8Array>(method.path, this.call(method, message, options)).then(
			(bytes) => method.codec.decode(bytes),
		);
	}

	/**
	 * The POST, with the caller's options over the top.
	 *
	 * Headers are MERGED rather than replaced: a caller adding an authorization
	 * header would otherwise drop the content type and `x-grpc-web`, and the
	 * server would answer a `415` about a request it never tried to route.
	 */
	private call<TRequest, TResponse>(
		method: ILankaGrpcMethod<TRequest, TResponse>,
		message: TRequest,
		options?: TLankaExecuteOptions<RequestInit>,
	): TLankaExecuteOptions<RequestInit> {
		return {
			method: "POST",
			...options,
			headers: {
				"content-type": this.contentType,
				// The header a gRPC-Web proxy reads to know this is not plain HTTP.
				"x-grpc-web": "1",
				...(options?.headers as Record<string, string> | undefined),
			},
			body: encodeLengthPrefixed(method.codec.encode(message)) as unknown as BodyInit,
		};
	}
}
