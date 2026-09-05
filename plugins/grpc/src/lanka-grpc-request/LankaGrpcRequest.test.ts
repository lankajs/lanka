import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "lanka";
import { LankaError } from "lanka/errors";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { LankaGrpcRequest } from "./LankaGrpcRequest";
import { encodeLengthPrefixed } from "../_internal/encode-length-prefixed/encodeLengthPrefixed";

/**
 * The request kind, at the byte level.
 *
 * The playground drives it through a gateway, which is how a consumer meets it.
 * What is pinned here is the wire: where a status may hide, what an absent one
 * means, and that a body a proxy mangled is named rather than decoded.
 */

const framed = (message: unknown, status = 0, statusMessage = ""): Uint8Array => {
	const parts: Uint8Array[] = [];
	if (message !== undefined) {
		parts.push(encodeLengthPrefixed(new TextEncoder().encode(JSON.stringify(message))));
	}
	if (status >= 0) {
		const trailers = encodeLengthPrefixed(
			new TextEncoder().encode(
				`grpc-status: ${String(status)}\r\ngrpc-message: ${encodeURIComponent(statusMessage)}\r\n`,
			),
		);
		trailers[0] = 0x80;
		parts.push(trailers);
	}

	const body = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
	let at = 0;
	for (const part of parts) {
		body.set(part, at);
		at += part.length;
	}

	return body;
};

const answering = (body: BodyInit | null, init: ResponseInit = {}) => ({
	request: () => Promise.resolve(new Response(body, init)),
});

beforeEach(() => {
	createLanka({ host: lankaTestHost });
});

describe("LankaGrpcRequest", () => {
	it("answers the response message's bytes", async () => {
		const request = new LankaGrpcRequest({
			transport: answering(framed({ id: "7" }) as unknown as BodyInit),
		});

		const bytes = await request.execute<Uint8Array>("/s/M", { method: "POST" });

		expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual({ id: "7" });
	});

	it("decodes the message the server sent, percent-encoding and all", async () => {
		// `grpc-message` is percent-encoded on the wire, and a message shown raw
		// reads as `Not%20found` on somebody's screen.
		const request = new LankaGrpcRequest({
			transport: answering(framed(undefined, 5, "Not found") as unknown as BodyInit),
		});

		const failure = await request.execute("/s/M").catch((error: unknown) => error);

		expect((failure as LankaError).message).toBe("Not found");
	});

	it("reads a status the server put in the headers instead", async () => {
		const request = new LankaGrpcRequest({
			transport: answering(new Uint8Array(0), {
				headers: { "grpc-status": "16", "grpc-message": "no token" },
			}),
		});

		const failure = await request.execute("/s/M").catch((error: unknown) => error);

		expect((failure as LankaError).code).toBe("UNAUTHENTICATED");
		expect((failure as LankaError).message).toBe("no token");
	});

	it("prefers the trailers when both carry one", async () => {
		// The trailers are written last and by the handler; a header can be a
		// proxy's guess.
		const request = new LankaGrpcRequest({
			transport: answering(framed(undefined, 7) as unknown as BodyInit, {
				headers: { "grpc-status": "0" },
			}),
		});

		const failure = await request.execute("/s/M").catch((error: unknown) => error);

		expect((failure as LankaError).code).toBe("PERMISSION_DENIED");
	});

	it("reads an unparseable status as UNKNOWN rather than as success", async () => {
		const request = new LankaGrpcRequest({
			transport: answering(new Uint8Array(0), {
				headers: { "grpc-status": "not a number" },
			}),
		});

		const failure = await request.execute("/s/M").catch((error: unknown) => error);

		expect((failure as LankaError).code).toBe("UNKNOWN");
	});

	it("refuses a success that carried no message", async () => {
		// Answering empty bytes would hand the codec something it decodes into
		// defaults, and a screen would render zeroes as data.
		const request = new LankaGrpcRequest({
			transport: answering(framed(undefined) as unknown as BodyInit),
		});

		const failure = await request.execute("/s/M").catch((error: unknown) => error);

		expect((failure as LankaError).kind).toBe("schema");
	});

	it("hands a non-2xx body to the error handler before failing", async () => {
		// The handler is the application's one chance to read the body: a `Response`
		// is read once, and after this it is drained.
		const errorHandler = vi.fn(() => Promise.reject(new Error("read by the handler")));
		const request = new LankaGrpcRequest({
			transport: answering("gateway timeout", { status: 504 }),
			errorHandler,
		});

		const failure = await request.execute("/s/M").catch((error: unknown) => error);

		expect(errorHandler).toHaveBeenCalledTimes(1);
		expect((failure as Error).message).toBe("read by the handler");
	});

	it("reports a non-2xx as `http`, with the status", async () => {
		const request = new LankaGrpcRequest({
			transport: answering(null, { status: 502 }),
			errorHandler: () => Promise.resolve() as Promise<never>,
		});

		const failure = await request.execute("/s/M").catch((error: unknown) => error);

		expect((failure as LankaError).kind).toBe("http");
		expect((failure as LankaError).status).toBe(502);
	});

	it("answers the mock without touching the transport", async () => {
		const transport = { request: vi.fn() };
		const request = new LankaGrpcRequest({ transport, useMock: true });

		await expect(
			request.execute("/s/M", undefined, () => Promise.resolve(new Uint8Array([1]))),
		).resolves.toEqual(new Uint8Array([1]));
		expect(transport.request).not.toHaveBeenCalled();
	});
});

describe("a response with no status anywhere", () => {
	it("is read as the message it carried", async () => {
		// A server, or a proxy, that omits the trailers block and sets no header.
		// Refused, an ordinary answer would reach the screen as a schema failure.
		const message = encodeLengthPrefixed(new TextEncoder().encode(JSON.stringify({ id: "7" })));
		const request = new LankaGrpcRequest({
			transport: answering(message as unknown as BodyInit),
		});

		const bytes = await request.execute<Uint8Array>("/s/M", { method: "POST" });

		expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual({ id: "7" });
	});
});
