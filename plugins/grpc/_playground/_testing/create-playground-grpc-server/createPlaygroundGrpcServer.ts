import type { ILankaTransport } from "lanka/gateway";

/** What a scripted call answers. */
export interface IPlaygroundGrpcAnswer {
	/** The one response message, before framing. Omit for a trailers-only answer. */
	message?: unknown;
	/** The gRPC status. `0` unless a test is about a failure. */
	status?: number;
	/** The `grpc-message` trailer. */
	statusMessage?: string;
	/** Put the status in the HTTP headers instead of the trailers block. */
	inHeaders?: boolean;
	/** The HTTP status, for the case where the failure is below gRPC. */
	httpStatus?: number;
}

/** What a test can ask the server afterwards. */
export interface IPlaygroundGrpcServer {
	transport: ILankaTransport<RequestInit>;
	/** Every path the application called, in order. */
	calls: () => string[];
	/** The request message of the last call, decoded from the frame. */
	lastMessage: () => unknown;
}

const frame = (bytes: Uint8Array, flag: number): Uint8Array => {
	const framed = new Uint8Array(5 + bytes.length);
	framed[0] = flag;
	new DataView(framed.buffer).setUint32(1, bytes.length, false);
	framed.set(bytes, 5);

	return framed;
};

const bodyOf = (answer: IPlaygroundGrpcAnswer): Uint8Array => {
	const parts: Uint8Array[] = [];
	if (answer.message !== undefined) {
		parts.push(frame(new TextEncoder().encode(JSON.stringify(answer.message)), 0));
	}
	if (!answer.inHeaders) {
		const trailers =
			`grpc-status: ${String(answer.status ?? 0)}\r\n` +
			`grpc-message: ${encodeURIComponent(answer.statusMessage ?? "")}\r\n`;
		parts.push(frame(new TextEncoder().encode(trailers), 0x80));
	}

	const total = parts.reduce((sum, part) => sum + part.length, 0);
	const body = new Uint8Array(total);
	let at = 0;
	for (const part of parts) {
		body.set(part, at);
		at += part.length;
	}

	return body;
};

/**
 * The gRPC-Web endpoint, as far as this application can tell.
 *
 * The transport IS the outside world for the unary half of the package, so it is
 * the one thing stubbed — and it stubs it at the BYTE level, framing and
 * trailers included, because those are what the package is for. A double that
 * answered decoded messages would prove the double works.
 */
export const createPlaygroundGrpcServer = (
	answers: readonly IPlaygroundGrpcAnswer[],
): IPlaygroundGrpcServer => {
	const calls: string[] = [];
	const bodies: Uint8Array[] = [];
	let turn = 0;

	return {
		transport: {
			request: (resource: RequestInfo, options?: RequestInit) => {
				calls.push(typeof resource === "string" ? resource : resource.url);
				bodies.push(new Uint8Array(options?.body as ArrayBuffer as never));
				const answer = answers[Math.min(turn, answers.length - 1)];
				turn += 1;

				const headers: Record<string, string> = {
					"content-type": "application/grpc-web+json",
				};
				if (answer.inHeaders) headers["grpc-status"] = String(answer.status ?? 0);

				return Promise.resolve(
					new Response(bodyOf(answer) as unknown as BodyInit, {
						status: answer.httpStatus ?? 200,
						headers,
					}),
				);
			},
		},
		calls: () => calls,
		lastMessage: () => {
			const body = bodies.at(-1);
			if (!body) return undefined;

			return JSON.parse(new TextDecoder().decode(body.slice(5))) as unknown;
		},
	};
};
