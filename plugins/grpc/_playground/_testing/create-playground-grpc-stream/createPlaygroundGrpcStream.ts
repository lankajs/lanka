import type { TLankaGrpcStreamOpener } from "../../../src/index";

/** A stream a test drives message by message. */
export interface IPlaygroundGrpcStream {
	open: TLankaGrpcStreamOpener;
	/** How many times the application opened the call. */
	opens: () => number;
	/** Pushes one message down the current stream, framed. */
	push: (message: unknown) => void;
	/** Pushes raw bytes, for the split-frame case. */
	pushBytes: (bytes: Uint8Array) => void;
	/** Ends the stream with a status in the trailers block. */
	end: (status?: number, message?: string) => void;
	/** The next call answers this HTTP status instead of a stream. */
	refuseWith: (httpStatus: number) => void;
}

const frame = (bytes: Uint8Array, flag: number): Uint8Array => {
	const framed = new Uint8Array(5 + bytes.length);
	framed[0] = flag;
	new DataView(framed.buffer).setUint32(1, bytes.length, false);
	framed.set(bytes, 5);

	return framed;
};

/**
 * A server stream, as far as this application can tell.
 *
 * A `ReadableStream` that a test pushes into, so a scene can say "two messages
 * arrive, then the server ends the call" and watch it become two scenarios and a
 * reconnect. Framing is done here rather than by the package, which is the
 * point: the bytes are what the package reads.
 */
export const createPlaygroundGrpcStream = (): IPlaygroundGrpcStream => {
	let push: ((bytes: Uint8Array) => void) | null = null;
	let finish: (() => void) | null = null;
	let opens = 0;
	let refusal: number | null = null;

	const open: TLankaGrpcStreamOpener = () => {
		opens += 1;
		if (refusal !== null) {
			const status = refusal;
			refusal = null;
			return Promise.resolve(new Response(null, { status }));
		}

		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				push = (bytes) => controller.enqueue(bytes);
				finish = () => controller.close();
			},
		});

		return Promise.resolve(new Response(body as unknown as BodyInit, { status: 200 }));
	};

	return {
		open,
		opens: () => opens,
		push: (message) => push?.(frame(new TextEncoder().encode(JSON.stringify(message)), 0)),
		pushBytes: (bytes) => push?.(bytes),
		end: (status = 0, message = "") => {
			const trailers = `grpc-status: ${String(status)}\r\ngrpc-message: ${message}\r\n`;
			push?.(frame(new TextEncoder().encode(trailers), 0x80));
			finish?.();
		},
		refuseWith: (httpStatus) => {
			refusal = httpStatus;
		},
	};
};
