import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "lanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { LankaGrpcStreamTransport } from "./LankaGrpcStreamTransport";
import { createLankaGrpcJsonCodec } from "../_factories/create-lanka-grpc-json-codec/createLankaGrpcJsonCodec";

/**
 * The server stream, at the wire.
 *
 * The playground drives it through a plugin and a bridge. What is pinned here is
 * the address, the request that opens the call, and what happens when the far
 * end ends the stream badly — none of which a scene can see.
 */

interface IChange {
	kind: string;
	id: string;
}

const codec = createLankaGrpcJsonCodec<{ since: number }, IChange>();

const frame = (bytes: Uint8Array, flag: number): Uint8Array => {
	const framed = new Uint8Array(5 + bytes.length);
	framed[0] = flag;
	new DataView(framed.buffer).setUint32(1, bytes.length, false);
	framed.set(bytes, 5);
	return framed;
};

const streamOf = (write: (push: (bytes: Uint8Array) => void, close: () => void) => void) =>
	new Response(
		new ReadableStream<Uint8Array>({
			start(controller) {
				write(
					(bytes) => controller.enqueue(bytes),
					() => controller.close(),
				);
			},
		}),
		{ status: 200 },
	);

/** The stream is read asynchronously; let the reader run. */
const settle = async (): Promise<void> => {
	for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
};

const shape = {
	path: "/playground.Todos/Watch",
	request: { since: 0 },
	codec,
	eventTypeOf: (change: IChange) => (change.kind === "completed" ? "todo.completed" : null),
};

beforeEach(() => {
	createLanka({ host: { ...lankaTestHost, apiBaseUrl: "https://api.test/v1/" } });
});

afterEach(() => {
	vi.useRealTimers();
});

describe("the address", () => {
	it("comes from the host and keeps the gRPC path as written", () => {
		let asked = "";
		const transport = new LankaGrpcStreamTransport({
			...shape,
			openStream: (url) => {
				asked = url;
				return Promise.resolve(new Response(null, { status: 503 }));
			},
		});

		transport.connect();

		expect(asked).toBe("https://api.test/v1/playground.Todos/Watch");
	});

	it("accepts a path written without its leading slash", () => {
		let asked = "";
		const transport = new LankaGrpcStreamTransport({
			...shape,
			path: "playground.Todos/Watch",
			openStream: (url) => {
				asked = url;
				return Promise.resolve(new Response(null, { status: 503 }));
			},
		});

		transport.connect();

		expect(asked).toBe("https://api.test/v1/playground.Todos/Watch");
	});

	it("is taken whole when the stream is somewhere else", () => {
		let asked = "";
		const transport = new LankaGrpcStreamTransport({
			...shape,
			url: "https://stream.test/watch",
			openStream: (url) => {
				asked = url;
				return Promise.resolve(new Response(null, { status: 503 }));
			},
		});

		transport.connect();

		expect(asked).toBe("https://stream.test/watch");
	});
});

describe("the call that opens the stream", () => {
	it("sends the request message, framed, with the gRPC headers", async () => {
		let init: RequestInit | null = null;
		const transport = new LankaGrpcStreamTransport({
			...shape,
			headers: { authorization: "Bearer t" },
			openStream: (_url, given) => {
				init = given;
				return Promise.resolve(new Response(null, { status: 503 }));
			},
		});

		transport.connect();
		await settle();

		const headers = (init as unknown as RequestInit).headers as Record<string, string>;
		expect(headers["content-type"]).toBe("application/grpc-web+proto");
		expect(headers["x-grpc-web"]).toBe("1");
		expect(headers.authorization).toBe("Bearer t");
		expect(
			new Uint8Array((init as unknown as RequestInit).body as ArrayBuffer as never),
		).toHaveLength(5 + JSON.stringify({ since: 0 }).length);
	});

	it("reports no support where nothing can send it", () => {
		vi.stubGlobal("fetch", undefined);
		try {
			expect(new LankaGrpcStreamTransport(shape).isSupported()).toBe(false);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe("reading the stream", () => {
	it("delivers a decoded message under the name the application gave it", async () => {
		const heard = vi.fn();
		const transport = new LankaGrpcStreamTransport({
			...shape,
			openStream: () =>
				Promise.resolve(
					streamOf((push, close) => {
						push(
							frame(
								new TextEncoder().encode(
									JSON.stringify({ kind: "completed", id: "7" }),
								),
								0,
							),
						);
						close();
					}),
				),
		});
		transport.on("todo.completed", heard);

		transport.connect();
		await settle();

		expect(heard).toHaveBeenCalledWith({ kind: "completed", id: "7" });
		transport.disconnect();
	});

	it("reports a failing status in the trailers rather than throwing it", async () => {
		// Nobody is awaiting a stream: a throw would become an unhandled rejection
		// and the reason would reach no log the application controls.
		const onStatusFailure = vi.fn();
		const transport = new LankaGrpcStreamTransport({
			...shape,
			onStatusFailure,
			openStream: () =>
				Promise.resolve(
					streamOf((push, close) => {
						push(
							frame(
								new TextEncoder().encode(
									"grpc-status: 7\r\ngrpc-message: nope\r\n",
								),
								0x80,
							),
						);
						close();
					}),
				),
		});

		transport.connect();
		await settle();
		transport.disconnect();

		expect(onStatusFailure).toHaveBeenCalledTimes(1);
		expect((onStatusFailure.mock.calls[0]?.[0] as Error).message).toBe("nope");
	});

	it("says nothing about a clean end", async () => {
		const onStatusFailure = vi.fn();
		const transport = new LankaGrpcStreamTransport({
			...shape,
			onStatusFailure,
			openStream: () =>
				Promise.resolve(
					streamOf((push, close) => {
						push(frame(new TextEncoder().encode("grpc-status: 0\r\n"), 0x80));
						close();
					}),
				),
		});

		transport.connect();
		await settle();
		transport.disconnect();

		expect(onStatusFailure).not.toHaveBeenCalled();
	});

	it("survives a call that could not be made at all", async () => {
		// A `fetch` that rejects — DNS, an offline device — must enter the ladder
		// rather than leave an unhandled rejection behind.
		vi.useFakeTimers();
		let attempts = 0;
		const transport = new LankaGrpcStreamTransport({
			...shape,
			openStream: () => {
				attempts += 1;
				return Promise.reject(new Error("offline"));
			},
		});

		transport.connect();
		await vi.advanceTimersByTimeAsync(1000);
		transport.disconnect();

		expect(attempts).toBe(2);
	});
});
