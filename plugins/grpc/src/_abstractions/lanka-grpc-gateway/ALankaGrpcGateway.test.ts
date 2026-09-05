import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "lanka";
import type { TLankaExecuteOptions } from "lanka/gateway";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { ALankaGrpcGateway } from "./ALankaGrpcGateway";
import { createLankaGrpcJsonCodec } from "../../_factories/create-lanka-grpc-json-codec/createLankaGrpcJsonCodec";
import { createLankaGrpcRequest } from "../../_factories/create-lanka-grpc-request/createLankaGrpcRequest";
import { encodeLengthPrefixed } from "../../_internal/encode-length-prefixed/encodeLengthPrefixed";
import type { ILankaGrpcMethod } from "../../_interfaces/ILankaGrpcMethod";

/**
 * Where the codec meets the framing.
 *
 * The playground proves a call works end to end. What is pinned here is what a
 * caller can quietly break: the headers a gRPC-Web proxy reads, and whether an
 * option of their own replaces them or joins them.
 */

const METHOD: ILankaGrpcMethod<{ id: string }, { done: boolean }> = {
	path: "/todos.Todos/Complete",
	codec: createLankaGrpcJsonCodec<{ id: string }, { done: boolean }>(),
};

const answer = (): Uint8Array => {
	const message = encodeLengthPrefixed(new TextEncoder().encode(JSON.stringify({ done: true })));
	const trailers = encodeLengthPrefixed(new TextEncoder().encode("grpc-status: 0\r\n"));
	trailers[0] = 0x80;

	const body = new Uint8Array(message.length + trailers.length);
	body.set(message);
	body.set(trailers, message.length);

	return body;
};

class TestGateway extends ALankaGrpcGateway {
	public complete(id: string, options?: TLankaExecuteOptions<RequestInit>) {
		return this.unary(METHOD, { id }, options);
	}

	public completeMocked(id: string, mockHandler: () => Promise<{ done: boolean }>) {
		return this.unary(METHOD, { id }, undefined, mockHandler);
	}
}

const recordingTransport = () => {
	const seen: RequestInit[] = [];

	return {
		seen,
		transport: {
			request: (_resource: RequestInfo, options?: RequestInit) => {
				seen.push(options ?? {});
				return Promise.resolve(
					new Response(answer() as unknown as BodyInit, { status: 200 }),
				);
			},
		},
	};
};

beforeEach(() => {
	createLanka({ host: lankaTestHost });
});

describe("ALankaGrpcGateway", () => {
	it("sends the gRPC-Web headers a proxy reads", async () => {
		const wire = recordingTransport();
		const gateway = new TestGateway({
			request: createLankaGrpcRequest({ transport: wire.transport }),
		});

		await gateway.complete("7");

		const headers = wire.seen[0]?.headers as Record<string, string>;
		expect(headers["content-type"]).toBe("application/grpc-web+proto");
		expect(headers["x-grpc-web"]).toBe("1");
	});

	it("takes the content type a JSON codec needs", async () => {
		const wire = recordingTransport();
		const gateway = new TestGateway({
			request: createLankaGrpcRequest({ transport: wire.transport }),
			contentType: "application/grpc-web+json",
		});

		await gateway.complete("7");

		expect((wire.seen[0]?.headers as Record<string, string>)["content-type"]).toBe(
			"application/grpc-web+json",
		);
	});

	it("merges a caller's header instead of dropping its own", async () => {
		// Replaced, the content type and `x-grpc-web` would be gone and the server
		// would answer a 415 about a request it never tried to route.
		const wire = recordingTransport();
		const gateway = new TestGateway({
			request: createLankaGrpcRequest({ transport: wire.transport }),
		});

		await gateway.complete("7", { headers: { authorization: "Bearer t" } });

		const headers = wire.seen[0]?.headers as Record<string, string>;
		expect(headers.authorization).toBe("Bearer t");
		expect(headers["x-grpc-web"]).toBe("1");
	});

	it("answers the decoded response", async () => {
		const wire = recordingTransport();
		const gateway = new TestGateway({
			request: createLankaGrpcRequest({ transport: wire.transport }),
		});

		await expect(gateway.complete("7")).resolves.toEqual({ done: true });
	});

	it("ignores a mock handler while mock mode is off", async () => {
		// Otherwise a mock left behind in a merged branch answers in production.
		const wire = recordingTransport();
		const gateway = new TestGateway({
			request: createLankaGrpcRequest({ transport: wire.transport }),
		});
		const mock = vi.fn(() => Promise.resolve({ done: false }));

		await expect(gateway.completeMocked("7", mock)).resolves.toEqual({ done: true });
		expect(mock).not.toHaveBeenCalled();
	});

	it("answers the mock, and sends nothing, while mock mode is on", async () => {
		const wire = recordingTransport();
		const gateway = new TestGateway({
			request: createLankaGrpcRequest({ transport: wire.transport }),
			useMock: true,
		});

		await expect(
			gateway.completeMocked("7", () => Promise.resolve({ done: false })),
		).resolves.toEqual({ done: false });
		expect(wire.seen).toEqual([]);
	});
});
