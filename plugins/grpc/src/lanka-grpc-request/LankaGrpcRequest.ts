import { ALankaRequest, LankaFetchTransport, type ILankaTransport } from "lanka/gateway";
import { LankaError, type TLankaErrorHandler } from "lanka/errors";
import { getLankaHost } from "lanka/config";
import { readLengthPrefixedFrames } from "../_internal/read-length-prefixed-frames/readLengthPrefixedFrames";
import { parseTrailers } from "../_internal/parse-trailers/parseTrailers";
import { grpcFailure } from "../_internal/grpc-failure/grpcFailure";

export interface ILankaGrpcRequestConfig<TOptions = RequestInit> {
	/** What puts bytes on the wire. Defaults to `LankaFetchTransport`. */
	transport?: ILankaTransport<TOptions>;
	/** Reads a non-2xx body before the failure is thrown. */
	errorHandler?: TLankaErrorHandler;
	/** Answer mock handlers instead of sending. Defaults to the instance flag. */
	useMock?: boolean;
}

const STATUS_HEADER = "grpc-status";
const MESSAGE_HEADER = "grpc-message";

/**
 * The status the response carries, from wherever it put it.
 *
 * A trailers-only response — which is what a call refused before any message
 * looks like — has no body to find it in and puts it in the HTTP headers. A
 * reader that only knew the trailers would report a schema failure for what is
 * an ordinary permission denial.
 */
const statusOf = (
	headers: Headers,
	trailers: Record<string, string>,
): { code: number; message: string } | null => {
	const raw = trailers[STATUS_HEADER] ?? headers.get(STATUS_HEADER);
	if (raw === null || raw === undefined) return null;

	const code = Number(raw);
	const message = trailers[MESSAGE_HEADER] ?? headers.get(MESSAGE_HEADER) ?? "";

	return { code: Number.isNaN(code) ? 2 : code, message: decodeURIComponent(message) };
};

/**
 * A gRPC-Web call as a request kind. Bytes in, bytes out.
 *
 * ## The split with the gateway
 *
 * This class owns the part everybody rewrites and nobody enjoys: the
 * length-prefixed framing, the trailers block, and the mapping from
 * `grpc-status` to a failure the application can branch on. It does NOT own the
 * codec — that belongs to whatever generated the message types, and
 * `ALankaGrpcGateway` is where the two meet.
 *
 * The consequence is that this is usable on its own: hand it a framed body and
 * it answers the response message's bytes, which is what a consumer with their
 * own gateway story wants.
 *
 * ## What a status becomes
 *
 * | Status                              | Kind      |
 * | ----------------------------------- | --------- |
 * | `CANCELLED`                         | `aborted` |
 * | `DEADLINE_EXCEEDED`                 | `timeout` |
 * | `UNAVAILABLE`                       | `network` |
 * | `UNIMPLEMENTED`, `INTERNAL`         | `http`    |
 * | everything else non-zero            | `domain`  |
 *
 * Without the mapping a cancelled call and a failed one look the same, and the
 * user is shown an error for leaving the screen.
 */
export class LankaGrpcRequest<TOptions = RequestInit> extends ALankaRequest<TOptions> {
	private readonly transport: ILankaTransport<TOptions>;

	public constructor(config: ILankaGrpcRequestConfig<TOptions> = {}) {
		super({ errorHandler: config.errorHandler, useMock: config.useMock });
		this.transport =
			config.transport ?? (new LankaFetchTransport() as ILankaTransport<TOptions>);
	}

	protected async request<TReturn = Response>(
		endpoint: string,
		options?: TOptions,
		mockHandler?: () => Promise<TReturn>,
	): Promise<TReturn> {
		if (this.useMock && mockHandler) return await mockHandler();

		const response = await this.transport.request(endpoint, options);
		if (!response.ok) return await this.refuse(response);

		return this.read(response, new Uint8Array(await response.arrayBuffer())) as TReturn;
	}

	/**
	 * Refuses a non-2xx response, and never returns.
	 *
	 * A gRPC-Web server that answers a real HTTP status has failed BELOW gRPC — a
	 * proxy, a gateway, a route that is not there — and `http` is what says so.
	 */
	private async refuse(response: Response): Promise<never> {
		if (this.errorHandler) await this.errorHandler(response);

		throw new LankaError({
			kind: "http",
			message: getLankaHost().httpErrorMessage(response.status),
			status: response.status,
		});
	}

	/** The one response message, or the failure the status described. */
	private read(response: Response, body: Uint8Array): Uint8Array {
		const { frames } = readLengthPrefixedFrames(body);
		const trailerFrame = frames.find((frame) => frame.isTrailers);
		const trailers = trailerFrame
			? parseTrailers(new TextDecoder().decode(trailerFrame.data))
			: {};

		const status = statusOf(response.headers, trailers);
		if (status && status.code !== 0) throw grpcFailure(status.code, status.message, trailers);

		const message = frames.find((frame) => !frame.isTrailers);
		if (message) return message.data;

		// Status `0` and no message is a contradiction the caller cannot act on:
		// something upstream ate the body, and answering empty bytes would hand the
		// codec a message it will decode into defaults.
		throw new LankaError({
			kind: "schema",
			message: "The gRPC call reported success and carried no message.",
		});
	}
}
