import { getLankaHost } from "lanka/config";
import {
	ALankaStreamTransport,
	type ILankaStreamConfig,
	type ILankaStreamTransportHandlers,
} from "lanka/stream";
import { encodeLengthPrefixed } from "../_internal/encode-length-prefixed/encodeLengthPrefixed";
import { readLengthPrefixedFrames } from "../_internal/read-length-prefixed-frames/readLengthPrefixedFrames";
import { parseTrailers } from "../_internal/parse-trailers/parseTrailers";
import { grpcFailure } from "../_internal/grpc-failure/grpcFailure";
import type { ILankaGrpcCodec } from "../_interfaces/ILankaGrpcCodec";

/** Sends the streaming call and answers the response to read. */
export type TLankaGrpcStreamOpener = (url: string, init: RequestInit) => Promise<Response>;

export interface ILankaGrpcStreamConfig<TRequest, TMessage> extends ILankaStreamConfig {
	/** The gRPC path — `/package.Service/Watch`, as the server declares it. */
	path: string;
	/** The single request message the stream is opened with. */
	request: TRequest;
	/** How the request and each message are encoded. */
	codec: ILankaGrpcCodec<TRequest, TMessage>;
	/**
	 * Which named event a decoded message is. `null` drops it.
	 *
	 * A server stream is ONE call carrying many kinds of thing, and a bridge
	 * subscribes by name. This is the only place that knows the message's shape,
	 * and it belongs to the application for the same reason a bridge does.
	 */
	eventTypeOf: (message: TMessage) => string | null;
	/** What a bridge receives. Defaults to the decoded message. */
	payloadOf?: (message: TMessage) => Record<string, unknown>;
	/** The whole address, when the stream is not under the API base. */
	url?: string;
	/** Extra headers — an authorization one, most of the time. */
	headers?: Record<string, string>;
	/** The content type. `application/grpc-web+proto` unless a codec says otherwise. */
	contentType?: string;
	/** A failing status in the trailers, before the link is treated as lost. */
	onStatusFailure?: (error: Error) => void;
	/** Sends the call. Defaults to the global `fetch`. */
	openStream?: TLankaGrpcStreamOpener;
}

const EMPTY = new Uint8Array(0);

const joined = (left: Uint8Array, right: Uint8Array): Uint8Array => {
	if (left.length === 0) return right;

	const both = new Uint8Array(left.length + right.length);
	both.set(left);
	both.set(right, left.length);

	return both;
};

/**
 * A gRPC server stream as a source of change.
 *
 * The same framing as a unary call, arriving over time — so nothing new is
 * needed on the wire, and nothing above this class knows it is on gRPC: bridges
 * see named events exactly as they do from a server-sent stream or a socket.
 *
 * ## Why the message says which event it is
 *
 * A server stream is ONE call. There is no per-event channel and no subscription
 * protocol, so the name has to come out of the message — which means the
 * application decides, through `eventTypeOf`. The alternative is a convention
 * about a field, and a convention is a rule nobody can check.
 *
 * ## Partial frames are the whole difficulty
 *
 * Bytes arrive in chunks the network chose. A five-byte header can be split
 * across two reads and a message across ten, so what is not yet a whole frame is
 * kept and joined to what comes next. A reader that assumed each chunk held
 * whole frames works in every test and drops messages under load.
 *
 * ## An ended stream is a link to re-establish
 *
 * A server that closes the stream — cleanly, or with a failing status — is a
 * connection that is no longer delivering, so it enters the same reconnect
 * ladder as a dropped one. A stream that ended and stayed ended would be a
 * screen that is quietly permanently stale.
 */
export class LankaGrpcStreamTransport<TRequest, TMessage> extends ALankaStreamTransport {
	private readonly streamConfig: ILankaGrpcStreamConfig<TRequest, TMessage>;
	private readonly opener: TLankaGrpcStreamOpener;

	private controller: AbortController | null = null;
	private wire: ILankaStreamTransportHandlers | null = null;
	private pending: Uint8Array<ArrayBufferLike> = EMPTY;
	/** This connection already reported itself gone; several paths reach that. */
	private reported = false;

	public constructor(config: ILankaGrpcStreamConfig<TRequest, TMessage>) {
		super(config);
		this.streamConfig = config;
		this.opener = config.openStream ?? ((url, init) => fetch(url, init));
	}

	public override isSupported(): boolean {
		return Boolean(this.streamConfig.openStream) || typeof fetch === "function";
	}

	protected open(handlers: ILankaStreamTransportHandlers): void {
		this.wire = handlers;
		this.reported = false;
		this.pending = EMPTY;
		this.controller = new AbortController();

		void this.pump(this.controller.signal);
	}

	protected close(): void {
		const controller = this.controller;
		this.controller = null;
		// `abort` is what ends a `fetch` body read; without it the pump keeps a
		// connection open after the application gave it up.
		controller?.abort();
	}

	private async pump(signal: AbortSignal): Promise<void> {
		try {
			const response = await this.opener(this.address(), this.call(signal));
			if (!response.ok || !response.body) {
				this.reportLoss();
				return;
			}

			this.wire?.opened();
			await this.consume(response.body.getReader());
		} catch {
			// An abort lands here too, and reporting it is harmless: `close` has
			// already run, so the base knows the connection is gone and an explicit
			// disconnect has set the flag that outranks a scheduled attempt.
		}

		this.reportLoss();
	}

	private async consume(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
		for (;;) {
			const chunk = await reader.read();
			if (chunk.done) return;

			const { frames, rest } = readLengthPrefixedFrames(joined(this.pending, chunk.value));
			this.pending = rest;

			for (const frame of frames) {
				if (frame.isTrailers) {
					this.readStatus(frame.data);
					return;
				}
				this.emit(frame.data);
			}
		}
	}

	private emit(bytes: Uint8Array): void {
		const message = this.streamConfig.codec.decode(bytes);
		const eventType = this.streamConfig.eventTypeOf(message);
		if (eventType === null) return;

		const payload =
			this.streamConfig.payloadOf?.(message) ?? (message as Record<string, unknown>);
		this.wire?.received(eventType, payload);
	}

	private readStatus(bytes: Uint8Array): void {
		const trailers = parseTrailers(new TextDecoder().decode(bytes));
		const code = Number(trailers["grpc-status"] ?? "0");
		if (!code) return;

		// Reported rather than thrown: nobody is awaiting a stream, so a throw here
		// would become an unhandled rejection and the reason would reach no log the
		// application controls.
		this.streamConfig.onStatusFailure?.(
			grpcFailure(code, decodeURIComponent(trailers["grpc-message"] ?? ""), trailers),
		);
	}

	private address(): string {
		if (this.streamConfig.url) return this.streamConfig.url;

		const base = getLankaHost().apiBaseUrl.replace(/\/+$/, "");
		const path = this.streamConfig.path.startsWith("/")
			? this.streamConfig.path
			: `/${this.streamConfig.path}`;

		return `${base}${path}`;
	}

	private call(signal: AbortSignal): RequestInit {
		return {
			method: "POST",
			signal,
			headers: {
				"content-type": this.streamConfig.contentType ?? "application/grpc-web+proto",
				"x-grpc-web": "1",
				...this.streamConfig.headers,
			},
			body: encodeLengthPrefixed(
				this.streamConfig.codec.encode(this.streamConfig.request),
			) as unknown as BodyInit,
		};
	}

	private reportLoss(): void {
		if (this.reported) return;

		this.reported = true;
		this.wire?.lost();
	}
}
