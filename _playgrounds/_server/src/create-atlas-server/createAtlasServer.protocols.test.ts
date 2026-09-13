import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAtlasServer } from "./createAtlasServer";
import { frameAtlasGrpcMessage } from "../grpc/frame-atlas-grpc-message/frameAtlasGrpcMessage";
import type { IAtlasServer } from "./createAtlasServer";

let api: IAtlasServer;
let base: string;

beforeAll(async () => {
	api = createAtlasServer({ callsPerToken: 50 });
	base = await api.listen(0);
});

afterAll(async () => {
	await api.close();
});

const ask = async (query: string, variables: Record<string, unknown> = {}) => {
	const response = await fetch(`${base}/graphql`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ query, variables }),
	});

	return {
		status: response.status,
		body: (await response.json()) as { data: unknown; errors?: { message: string }[] },
	};
};

/** Reads length-prefixed frames the way the client's own reader does. */
const framesOf = (bytes: Uint8Array): { isTrailers: boolean; text: string }[] => {
	const frames: { isTrailers: boolean; text: string }[] = [];
	let at = 0;

	while (bytes.length - at >= 5) {
		const view = new DataView(bytes.buffer, bytes.byteOffset + at, 5);
		const length = view.getUint32(1, false);
		if (bytes.length - at - 5 < length) break;

		frames.push({
			isTrailers: (bytes[at] & 0x80) !== 0,
			text: new TextDecoder().decode(bytes.slice(at + 5, at + 5 + length)),
		});
		at += 5 + length;
	}

	return frames;
};

const callGrpc = async (method: string, message: unknown) => {
	const body = frameAtlasGrpcMessage(Buffer.from(JSON.stringify(message), "utf8"));
	const response = await fetch(`${base}/grpc/atlas.v1.Board/${method}`, {
		method: "POST",
		headers: { "content-type": "application/grpc-web+json" },
		body,
	});

	return { response, frames: framesOf(new Uint8Array(await response.arrayBuffer())) };
};

describe("graphql over HTTP", () => {
	it("answers a query with data", async () => {
		const { body } = await ask("query { missions { id title } }");

		expect(body.data).toHaveProperty("missions");
	});

	it("answers 200 with an errors array when the server refuses deliberately", async () => {
		// This is the whole reason `@lankajs/plugin-graphql` exists. Through an
		// ordinary JSON request kind it is a SUCCESS whose body somebody has to
		// inspect, and the applications that forget show a spinner over a failed
		// mutation until a reload.
		const { status, body } = await ask("mutation { completeMission(id: $id) { id } }", {
			id: "m-4",
		});

		expect(status).toBe(200);
		expect(body.data).toBeNull();
		expect(body.errors?.[0].message).toContain("already done");
	});

	it("carries a machine-readable code beside the sentence", async () => {
		const { body } = await ask("mutation { completeMission(id: $id) { id } }", { id: "m-4" });
		const extensions = (body.errors?.[0] as unknown as { extensions: { code: string } })
			.extensions;

		expect(extensions.code).toBe("ALREADY_DONE");
	});

	it("answers data AND errors for a partial result", async () => {
		// A nullable field resolved to null and said why while the rest of the page
		// resolved. Throwing it away is throwing away a page that rendered.
		const { body } = await ask("query { board { queued active forecast } }");

		expect(body.data).toHaveProperty("board.queued");
		expect(body.errors).toHaveLength(1);
	});

	it("refuses an operation it does not know, by name", async () => {
		const { body } = await ask("query { weather { today } }");

		expect(body.errors?.[0].message).toContain("no such operation");
	});
});

describe("grpc-web over HTTP", () => {
	it("answers a unary call with one message and a success status", async () => {
		const { frames } = await callGrpc("Summary", {});
		const message = frames.find((frame) => !frame.isTrailers);
		const trailers = frames.find((frame) => frame.isTrailers);

		expect(JSON.parse(message?.text ?? "{}")).toHaveProperty("queued");
		expect(trailers?.text).toContain("grpc-status:0");
	});

	it("puts a refusal in the HTTP headers when there is no message to carry it", async () => {
		// A trailers-only response is what a call refused before any message looks
		// like. A client that knew only the trailers would report a schema failure
		// for an ordinary permission denial.
		const { response, frames } = await callGrpc("Restricted", {});

		expect(response.headers.get("grpc-status")).toBe("7");
		expect(frames).toHaveLength(0);
	});

	it("opens a server stream with a message rather than with silence", async () => {
		// A stream whose first message waits for something to happen looks exactly
		// like a stream that never connected.
		const response = await fetch(`${base}/grpc/atlas.v1.Board/Watch`, {
			method: "POST",
			headers: { "content-type": "application/grpc-web+json" },
			body: frameAtlasGrpcMessage(Buffer.from("{}", "utf8")),
		});
		const reader = response.body?.getReader();
		const first = await reader?.read();

		expect(framesOf(first?.value ?? new Uint8Array())[0].text).toContain("opened");
		await reader?.cancel();
	});

	it("writes a frame for every change while a client is reading", async () => {
		const response = await fetch(`${base}/grpc/atlas.v1.Board/Watch`, {
			method: "POST",
			headers: { "content-type": "application/grpc-web+json" },
			body: frameAtlasGrpcMessage(Buffer.from("{}", "utf8")),
		});
		const reader = response.body?.getReader();
		await reader?.read();

		api.world.change("m-2", { status: "done" });
		const next = await reader?.read();

		expect(framesOf(next?.value ?? new Uint8Array())[0].text).toContain("mission.completed");
		await reader?.cancel();
	});

	it("answers 404 for a gRPC method nothing implements", async () => {
		const response = await fetch(`${base}/grpc/atlas.v1.Board/Nothing`, {
			method: "POST",
			headers: { "content-type": "application/grpc-web+json" },
			body: frameAtlasGrpcMessage(Buffer.from("{}", "utf8")),
		});

		expect(response.status).toBe(404);
	});
});
