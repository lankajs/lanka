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

describe("trailers that say less than they should", () => {
	it("reads a block with no status as a clean end", () => {
		// A proxy that rewrote the trailers, or a server that sent an empty block:
		// reported as a failure it would put a message in front of a user for
		// something that is not one.
		const onStatusFailure = vi.fn();
		const transport = new LankaGrpcStreamTransport({
			...shape,
			onStatusFailure,
			openStream: () =>
				Promise.resolve(
					streamOf((push, close) => {
						push(
							frame(
								new TextEncoder().encode("content-type: application/grpc\r\n"),
								0x80,
							),
						);
						close();
					}),
				),
		});

		transport.connect();
		transport.disconnect();

		expect(onStatusFailure).not.toHaveBeenCalled();
	});

	it("names a failure whose message the server left out", async () => {
		const onStatusFailure = vi.fn();
		const transport = new LankaGrpcStreamTransport({
			...shape,
			onStatusFailure,
			openStream: () =>
				Promise.resolve(
					streamOf((push, close) => {
						push(frame(new TextEncoder().encode("grpc-status: 9\r\n"), 0x80));
						close();
					}),
				),
		});

		transport.connect();
		await settle();
		transport.disconnect();

		expect((onStatusFailure.mock.calls[0]?.[0] as Error).message).toContain("9");
	});
});

describe("a call whose pump outlives it", () => {
	it("does not report the old loss against the connection that replaced it", async () => {
		// `close` aborts the fetch and the read rejects a microtask later, by which
		// time a reconnect may already have opened the next call. Reported then, the
		// ladder eats its own new connection and the screen never comes back.
		vi.useFakeTimers();
		const opens: (() => void)[] = [];
		let started = 0;
		const transport = new LankaGrpcStreamTransport({
			...shape,
			openStream: () => {
				started += 1;
				return Promise.resolve(
					streamOf((_push, close) => {
						// The first call ends; the second is left hanging open.
						if (started === 1) opens.push(close);
					}),
				);
			},
		});

		transport.connect();
		await settle();
		opens[0]?.();
		await vi.advanceTimersByTimeAsync(1000);
		await settle();

		// Two calls, and the second is still standing: nothing knocked it over.
		expect(started).toBe(2);

		await vi.advanceTimersByTimeAsync(60_000);
		expect(started).toBe(2);

		transport.disconnect();
		vi.useRealTimers();
	});

	it("survives a reconnect the application asked for by hand", async () => {
		// Sign out, sign in — or a "reconnect" button. The first call is aborted
		// while its body read is still pending, and that rejection arrives AFTER the
		// second call is already open. Reported, it would knock the new one over and
		// the screen would never come back.
		vi.useFakeTimers();
		let started = 0;
		const transport = new LankaGrpcStreamTransport({
			...shape,
			// Honours the signal the way a real `fetch` does: aborting ends the body
			// read, and that is what makes the late rejection possible at all.
			openStream: (_url, init) => {
				started += 1;
				const body = new ReadableStream<Uint8Array>({
					start(controller) {
						init.signal?.addEventListener("abort", () =>
							controller.error(new Error("aborted")),
						);
					},
				});
				return Promise.resolve(new Response(body as unknown as BodyInit, { status: 200 }));
			},
		});

		transport.connect();
		await settle();

		transport.disconnect();
		transport.connect();
		await settle();
		expect(started).toBe(2);

		// The stale pump has reported by now. If it were believed, the ladder would
		// have closed this call and opened a third.
		await vi.advanceTimersByTimeAsync(60_000);
		expect(started).toBe(2);

		transport.disconnect();
		vi.useRealTimers();
	});
});

describe("a response the server sent without trailers", () => {
	it("is read as the message it carried", async () => {
		// A server, or a proxy, that omits the trailers block entirely. There is no
		// status to refuse on, and the message is what the caller asked for.
		const heard = vi.fn();
		const transport = new LankaGrpcStreamTransport({
			...shape,
			openStream: () =>
				Promise.resolve(
					streamOf((push, close) => {
						push(
							frame(
								new TextEncoder().encode(
									JSON.stringify({ kind: "completed", id: "3" }),
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
		transport.disconnect();

		expect(heard).toHaveBeenCalledWith({ kind: "completed", id: "3" });
	});
});

describe("the stream the package opens for itself", () => {
	it("goes through the platform's own fetch when none was supplied", async () => {
		const asked: string[] = [];
		vi.stubGlobal("fetch", (url: string) => {
			asked.push(url);
			return Promise.resolve(new Response(null, { status: 503 }));
		});

		try {
			const transport = new LankaGrpcStreamTransport(shape);

			transport.connect();
			await settle();
			transport.disconnect();

			expect(asked).toEqual(["https://api.test/v1/playground.Todos/Watch"]);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
