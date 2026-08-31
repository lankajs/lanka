import { afterEach, describe, expect, it, vi } from "vitest";
import { LankaFetchFormDataTransport } from "./LankaFetchFormDataTransport";

const makeResponse = () => new Response("ok", { status: 200 });

describe("LankaFetchFormDataTransport", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("removes Content-Type header when body is FormData", async () => {
		const response = makeResponse();
		const fetchMock = vi.fn(async () => response);
		vi.stubGlobal("fetch", fetchMock);

		const transport = new LankaFetchFormDataTransport();
		const formData = new FormData();
		const headers = new Headers({
			"Content-Type": "application/json",
		});

		await transport.request("/api", {
			method: "POST",
			body: formData,
			headers,
		});

		const call = fetchMock.mock.calls[0] as unknown as [RequestInfo, RequestInit?];
		const options = call[1];
		expect(options).toBeDefined();
		expect(options?.headers).toBeInstanceOf(Headers);
		expect((options?.headers as Headers).get("Content-Type")).toBeNull();
	});

	it("passes options through when body is not FormData", async () => {
		const response = makeResponse();
		const fetchMock = vi.fn(async () => response);
		vi.stubGlobal("fetch", fetchMock);

		const transport = new LankaFetchFormDataTransport();
		await transport.request("/api", {
			method: "POST",
			body: "raw",
			headers: { "Content-Type": "text/plain" },
		});

		expect(fetchMock).toHaveBeenCalledWith("/api", {
			method: "POST",
			body: "raw",
			headers: { "Content-Type": "text/plain" },
		});
	});

	it("returns non-ok responses without throwing", async () => {
		const response = new Response("fail", {
			status: 400,
		});
		const fetchMock = vi.fn(async () => response);
		vi.stubGlobal("fetch", fetchMock);

		const transport = new LankaFetchFormDataTransport();
		const res = await transport.request("/api", {
			method: "POST",
		});

		expect(res).toBe(response);
		expect(res.ok).toBe(false);
		expect(res.status).toBe(400);
	});

	it("propagates fetch errors (timeout/abort)", async () => {
		const error = new Error("AbortError");
		error.name = "AbortError";
		const fetchMock = vi.fn(async () => {
			throw error;
		});
		vi.stubGlobal("fetch", fetchMock);

		const transport = new LankaFetchFormDataTransport();

		await expect(transport.request("/api", { method: "POST" })).rejects.toThrow("AbortError");
	});
	it("stress: repeated FormData requests (timing)", async () => {
		const response = makeResponse();
		const fetchMock = vi.fn(async () => response);
		vi.stubGlobal("fetch", fetchMock);

		const transport = new LankaFetchFormDataTransport();
		const iterations = 100;

		const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

		const start = now();
		await Promise.all(
			Array.from({ length: iterations }, () =>
				transport.request("/api", {
					method: "POST",
					body: new FormData(),
					headers: new Headers({
						"Content-Type": "application/json",
					}),
				}),
			),
		);
		const durationMs = now() - start;

		console.info(
			`LankaFetchFormDataTransport request stress duration: ${durationMs.toFixed(2)}ms`,
		);
		expect(fetchMock).toHaveBeenCalledTimes(iterations);
	});
});
