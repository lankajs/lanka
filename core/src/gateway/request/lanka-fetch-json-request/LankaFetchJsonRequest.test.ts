import { describe, expect, it, vi } from "vitest";
import { LankaFetchJsonRequest } from "./LankaFetchJsonRequest";

const makeJsonResponse = (body: unknown, status = 200, contentType = "application/json") =>
	new Response(body !== undefined ? JSON.stringify(body) : "", {
		status,
		headers: { "content-type": contentType },
	});

describe("FetchJsonRequest", () => {
	it("uses mock handler when useMock is true", async () => {
		const transport = {
			request: vi.fn(async () => makeJsonResponse({ ok: true })),
		};
		const request = new LankaFetchJsonRequest({
			transport,
			useMock: true,
		});
		const mockHandler = vi.fn(async () => "mocked");

		const res = await request.execute("/api", {}, mockHandler);

		expect(res).toBe("mocked");
		expect(mockHandler).toHaveBeenCalledOnce();
		expect(transport.request).not.toHaveBeenCalled();
	});

	it("parses JSON body when response is ok and has application/json content-type", async () => {
		const transport = {
			request: vi.fn(async () => makeJsonResponse({ id: 1 })),
		};
		const request = new LankaFetchJsonRequest({
			transport,
		});

		const res = await request.execute("/api");

		expect(res).toEqual({ id: 1 });
	});

	it("uses transport when useMock is true but no mock handler provided", async () => {
		const transport = {
			request: vi.fn(async () => makeJsonResponse({ id: 2 })),
		};
		const request = new LankaFetchJsonRequest({
			transport,
			useMock: true,
		});

		const res = await request.execute("/api");

		expect(res).toEqual({ id: 2 });
		expect(transport.request).toHaveBeenCalledWith("/api", undefined);
	});

	it("returns undefined when response has empty JSON body", async () => {
		const response = new Response("", {
			status: 200,
			headers: { "content-type": "application/json" },
		});
		const transport = {
			request: vi.fn(async () => response),
		};
		const request = new LankaFetchJsonRequest({
			transport,
		});

		const res = await request.execute("/api");

		expect(res).toBeUndefined();
	});

	it("throws when JSON parsing fails for application/json", async () => {
		const response = new Response("{", {
			status: 200,
			headers: { "content-type": "application/json" },
		});
		const transport = {
			request: vi.fn(async () => response),
		};
		const request = new LankaFetchJsonRequest({
			transport,
		});

		await expect(request.execute("/api")).rejects.toThrow("Failed to parse JSON response");
	});

	it("throws for an unparseable body when content-type is absent", async () => {
		// This used to resolve to `{}`. It is the case where a 200 is not an
		// answer — a misrouted request — and `{}` handed that to the caller's
		// schema, which reported it as a shape problem on the caller's screen.
		const response = new Response("not-json", {
			status: 200,
		});
		const transport = {
			request: vi.fn(async () => response),
		};
		const request = new LankaFetchJsonRequest({
			transport,
		});

		await expect(request.execute("/api")).rejects.toThrow("Failed to parse JSON response");
	});

	it("names the content-type it could not parse", async () => {
		// The SPA fallback: a dev server answering `index.html` for an /api path.
		// Naming `text/html` is the difference between "the console has a bug" and
		// "this request never reached the API".
		const response = new Response("<!doctype html><html></html>", {
			status: 200,
			headers: { "content-type": "text/html" },
		});
		const transport = {
			request: vi.fn(async () => response),
		};
		const request = new LankaFetchJsonRequest({
			transport,
		});

		await expect(request.execute("/api")).rejects.toThrow("content-type: text/html");
	});

	it("parses JSON even when content-type is missing", async () => {
		const response = new Response(JSON.stringify({ ok: true }), {
			status: 200,
		});
		const transport = {
			request: vi.fn(async () => response),
		};
		const request = new LankaFetchJsonRequest({
			transport,
		});

		const res = await request.execute("/api");

		expect(res).toEqual({ ok: true });
	});

	it("delegates to errorHandler when response is not ok", async () => {
		const response = makeJsonResponse({ error: "nope" }, 400);
		const transport = {
			request: vi.fn(async () => response),
		};
		const errorHandler = vi.fn(async () => {
			throw new Error("Handled");
		});
		const request = new LankaFetchJsonRequest({
			transport,
			errorHandler,
		});

		await expect(request.execute("/api")).rejects.toThrow("Handled");
		expect(errorHandler).toHaveBeenCalledOnce();
	});

	it("throws default error when response is not ok and no errorHandler", async () => {
		const response = makeJsonResponse({ error: "nope" }, 500);
		const transport = {
			request: vi.fn(async () => response),
		};
		const request = new LankaFetchJsonRequest({
			transport,
		});

		await expect(request.execute("/api")).rejects.toThrow("Request failed with status 500");
	});
	it("stress: repeated JSON execute calls (timing)", async () => {
		const transport = {
			request: vi.fn(async () => makeJsonResponse({ ok: true })),
		};
		const request = new LankaFetchJsonRequest({
			transport,
		});
		const iterations = 200;

		const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

		const start = now();
		await Promise.all(Array.from({ length: iterations }, () => request.execute("/api")));
		const durationMs = now() - start;

		console.info(`FetchJsonRequest execute stress duration: ${durationMs.toFixed(2)}ms`);
		expect(transport.request).toHaveBeenCalledTimes(iterations);
	});
});
