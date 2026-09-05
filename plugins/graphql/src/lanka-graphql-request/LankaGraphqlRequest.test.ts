import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "lanka";
import { LankaError } from "lanka/errors";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { LankaGraphqlRequest } from "./LankaGraphqlRequest";

/**
 * The request kind, against every shape a GraphQL endpoint answers with.
 *
 * The playground proves the common two through a gateway. What is pinned here is
 * the rest of the matrix — because "which of these is a failure" is the entire
 * value of this class, and each row of it is a decision somebody could get
 * wrong.
 */

const answering = (body: unknown, init: ResponseInit = {}) => ({
	request: () =>
		Promise.resolve(
			new Response(typeof body === "string" ? body : JSON.stringify(body), {
				headers: { "content-type": "application/json" },
				...init,
			}),
		),
});

beforeEach(() => {
	createLanka({ host: lankaTestHost });
});

describe("what is a success", () => {
	it("`data` alone", async () => {
		const request = new LankaGraphqlRequest({ transport: answering({ data: { todos: [] } }) });

		await expect(request.execute("/graphql")).resolves.toEqual({ todos: [] });
	});

	it("`data` beside errors — a page that rendered", async () => {
		const onPartialErrors = vi.fn();
		const request = new LankaGraphqlRequest({
			transport: answering({ data: { todos: [] }, errors: [{ message: "author gone" }] }),
			onPartialErrors,
		});

		await expect(request.execute("/graphql")).resolves.toEqual({ todos: [] });
		expect(onPartialErrors).toHaveBeenCalledWith([{ message: "author gone" }]);
	});

	it("a partial result nobody asked to hear about", async () => {
		// No handler is not a reason to throw the page away.
		const request = new LankaGraphqlRequest({
			transport: answering({ data: { todos: [] }, errors: [{ message: "author gone" }] }),
		});

		await expect(request.execute("/graphql")).resolves.toEqual({ todos: [] });
	});

	it("`data: null` with no errors — a query that legitimately resolved to nothing", async () => {
		const request = new LankaGraphqlRequest({ transport: answering({ data: null }) });

		await expect(request.execute("/graphql")).resolves.toBeNull();
	});

	it("an empty errors array, which is not an error", async () => {
		// Some servers send `errors: []` on success, and treating it as a refusal
		// would fail every call against them.
		const request = new LankaGraphqlRequest({
			transport: answering({ data: { todos: [] }, errors: [] }),
		});

		await expect(request.execute("/graphql")).resolves.toEqual({ todos: [] });
	});
});

describe("what is a failure", () => {
	it("errors with no data — the operation was refused", async () => {
		const request = new LankaGraphqlRequest({
			transport: answering({
				data: null,
				errors: [{ message: "Not your todo", extensions: { code: "FORBIDDEN" } }],
			}),
		});

		const failure = await request.execute("/graphql").catch((error: unknown) => error);

		expect((failure as LankaError).kind).toBe("domain");
		expect((failure as LankaError).code).toBe("FORBIDDEN");
	});

	it("and it carries every message, not only the first", async () => {
		// A validation failure names three fields, and showing one of them makes a
		// person fix the form three times.
		const request = new LankaGraphqlRequest({
			transport: answering({
				errors: [{ message: "name required" }, { message: "email required" }],
			}),
		});

		const failure = await request.execute("/graphql").catch((error: unknown) => error);

		expect((failure as LankaError).issues).toEqual(["name required", "email required"]);
	});

	it("and it survives a server that sent no code", async () => {
		const request = new LankaGraphqlRequest({
			transport: answering({ errors: [{ message: "no" }] }),
		});

		const failure = await request.execute("/graphql").catch((error: unknown) => error);

		expect((failure as LankaError).code).toBeUndefined();
	});

	it("and it says something when the server sent an error with no message", async () => {
		const request = new LankaGraphqlRequest({ transport: answering({ errors: [{}] }) });

		const failure = await request.execute("/graphql").catch((error: unknown) => error);

		expect((failure as LankaError).message).toContain("refused");
	});

	it("a body with neither `data` nor `errors`", async () => {
		// Not a GraphQL answer at all. Called anything else, `undefined` reaches a
		// schema and the reader is sent looking at their own query.
		const request = new LankaGraphqlRequest({ transport: answering({ ok: true }) });

		const failure = await request.execute("/graphql").catch((error: unknown) => error);

		expect((failure as LankaError).kind).toBe("schema");
	});

	it("a body that is not JSON", async () => {
		const request = new LankaGraphqlRequest({
			transport: answering("<!doctype html><html>a proxy answered"),
		});

		const failure = await request.execute("/graphql").catch((error: unknown) => error);

		expect((failure as LankaError).kind).toBe("schema");
		expect((failure as LankaError).message).toContain("doctype");
	});

	it("a JSON body that is not an object", async () => {
		const request = new LankaGraphqlRequest({ transport: answering("[1, 2, 3]") });

		const failure = await request.execute("/graphql").catch((error: unknown) => error);

		expect((failure as LankaError).kind).toBe("schema");
	});

	it("a non-2xx, which failed below GraphQL", async () => {
		const request = new LankaGraphqlRequest({
			transport: answering({}, { status: 503 }),
			errorHandler: () => Promise.resolve() as Promise<never>,
		});

		const failure = await request.execute("/graphql").catch((error: unknown) => error);

		expect((failure as LankaError).kind).toBe("http");
		expect((failure as LankaError).status).toBe(503);
	});
});

describe("the error handler", () => {
	it("reads a non-2xx body before the failure is thrown", async () => {
		// The application's one chance at the body: a `Response` is read once, and
		// after this it is drained.
		const errorHandler = vi.fn(() => Promise.reject(new Error("read by the handler")));
		const request = new LankaGraphqlRequest({
			transport: answering({ detail: "too many" }, { status: 429 }),
			errorHandler,
		});

		const failure = await request.execute("/graphql").catch((error: unknown) => error);

		expect(errorHandler).toHaveBeenCalledTimes(1);
		expect((failure as Error).message).toBe("read by the handler");
	});
});

describe("mock mode", () => {
	it("answers the mock without touching the transport", async () => {
		const transport = { request: vi.fn() };
		const request = new LankaGraphqlRequest({ transport, useMock: true });

		await expect(
			request.execute("/graphql", undefined, () => Promise.resolve({ todos: [] })),
		).resolves.toEqual({ todos: [] });
		expect(transport.request).not.toHaveBeenCalled();
	});

	it("ignores a mock handler while mock mode is off", async () => {
		// Otherwise a mock left behind in a merged branch answers in production.
		const request = new LankaGraphqlRequest({ transport: answering({ data: { real: true } }) });

		await expect(
			request.execute("/graphql", undefined, () => Promise.resolve({ mocked: true })),
		).resolves.toEqual({ real: true });
	});
});
