import { afterEach, describe, expect, it, vi } from "vitest";
import { LankaFetchJsonTransport } from "./LankaFetchJsonTransport";

const makeResponse = () => new Response("ok", { status: 200 });

describe("LankaFetchJsonTransport", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("sets Content-Type and stringifies plain object body", async () => {
		const response = makeResponse();
		const fetchMock = vi.fn(async () => response);
		vi.stubGlobal("fetch", fetchMock);

		const transport = new LankaFetchJsonTransport();
		await transport.request("/api", {
			method: "POST",
			body: { a: 1 } as unknown as BodyInit,
		});

		const call = fetchMock.mock.calls[0] as unknown as [RequestInfo, RequestInit?];
		const options = call[1];
		expect(options).toBeDefined();
		expect(options?.headers).toBeInstanceOf(Headers);
		expect((options?.headers as Headers).get("Content-Type")).toBe("application/json");
		expect(options?.body).toBe(JSON.stringify({ a: 1 }));
	});

	it("keeps body when it's already a string and still sets Content-Type", async () => {
		const response = makeResponse();
		const fetchMock = vi.fn(async () => response);
		vi.stubGlobal("fetch", fetchMock);

		const transport = new LankaFetchJsonTransport();
		await transport.request("/api", {
			method: "POST",
			body: JSON.stringify({ a: 1 }),
		});

		const call = fetchMock.mock.calls[0] as unknown as [RequestInfo, RequestInit?];
		const options = call[1];
		expect(options).toBeDefined();
		expect((options?.headers as Headers).get("Content-Type")).toBe("application/json");
		expect(options?.body).toBe(JSON.stringify({ a: 1 }));
	});

	it("does not set Content-Type when body is FormData", async () => {
		const response = makeResponse();
		const fetchMock = vi.fn(async () => response);
		vi.stubGlobal("fetch", fetchMock);

		const transport = new LankaFetchJsonTransport();
		const formData = new FormData();
		await transport.request("/api", {
			method: "POST",
			body: formData,
		});

		const call = fetchMock.mock.calls[0] as unknown as [RequestInfo, RequestInit?];
		const options = call[1];
		expect(options).toBeDefined();
		if (options?.headers instanceof Headers) {
			expect(options.headers.get("Content-Type")).toBeNull();
		} else {
			expect(options?.headers).toBeUndefined();
		}
	});

	it("passes through options when no body is provided", async () => {
		const response = makeResponse();
		const fetchMock = vi.fn(async () => response);
		vi.stubGlobal("fetch", fetchMock);

		const transport = new LankaFetchJsonTransport();
		await transport.request("/api", { method: "GET" });

		expect(fetchMock).toHaveBeenCalledWith("/api", {
			method: "GET",
		});
	});

	it("returns non-ok responses without throwing", async () => {
		const response = new Response("fail", {
			status: 503,
		});
		const fetchMock = vi.fn(async () => response);
		vi.stubGlobal("fetch", fetchMock);

		const transport = new LankaFetchJsonTransport();
		const res = await transport.request("/api", {
			method: "GET",
		});

		expect(res).toBe(response);
		expect(res.ok).toBe(false);
		expect(res.status).toBe(503);
	});

	it("propagates fetch errors (timeout/abort)", async () => {
		const error = new Error("AbortError");
		error.name = "AbortError";
		const fetchMock = vi.fn(async () => {
			throw error;
		});
		vi.stubGlobal("fetch", fetchMock);

		const transport = new LankaFetchJsonTransport();

		await expect(transport.request("/api", { method: "GET" })).rejects.toThrow("AbortError");
	});
	it("stress: repeated JSON requests (timing)", async () => {
		const response = makeResponse();
		const fetchMock = vi.fn(async () => response);
		vi.stubGlobal("fetch", fetchMock);

		const transport = new LankaFetchJsonTransport();
		const iterations = 100;

		const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

		const start = now();
		await Promise.all(
			Array.from({ length: iterations }, () =>
				transport.request("/api", {
					method: "POST",
					body: { a: 1 } as unknown as BodyInit,
				}),
			),
		);
		const durationMs = now() - start;

		console.info(`LankaFetchJsonTransport request stress duration: ${durationMs.toFixed(2)}ms`);
		expect(fetchMock).toHaveBeenCalledTimes(iterations);
	});
});
