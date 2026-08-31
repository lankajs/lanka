import { afterEach, describe, expect, it, vi } from "vitest";
import { LankaFetchTransport } from "./LankaFetchTransport";

const makeResponse = () => new Response("ok", { status: 200 });

describe("LankaFetchTransport", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("calls global fetch with resource and options", async () => {
		const response = makeResponse();
		const fetchMock = vi.fn(async () => response);
		vi.stubGlobal("fetch", fetchMock);

		const transport = new LankaFetchTransport();
		const res = await transport.request("/api", {
			method: "GET",
		});

		expect(res).toBe(response);
		expect(fetchMock).toHaveBeenCalledWith("/api", {
			method: "GET",
		});
	});

	it("passes undefined options through to fetch", async () => {
		const response = makeResponse();
		const fetchMock = vi.fn(async () => response);
		vi.stubGlobal("fetch", fetchMock);

		const transport = new LankaFetchTransport();
		await transport.request("/api");

		expect(fetchMock).toHaveBeenCalledWith("/api", undefined);
	});

	it("returns non-ok responses without throwing", async () => {
		const response = new Response("fail", {
			status: 500,
		});
		const fetchMock = vi.fn(async () => response);
		vi.stubGlobal("fetch", fetchMock);

		const transport = new LankaFetchTransport();
		const res = await transport.request("/api", {
			method: "GET",
		});

		expect(res).toBe(response);
		expect(res.ok).toBe(false);
		expect(res.status).toBe(500);
	});

	it("propagates fetch errors (timeout/abort)", async () => {
		const error = new Error("AbortError");
		error.name = "AbortError";
		const fetchMock = vi.fn(async () => {
			throw error;
		});
		vi.stubGlobal("fetch", fetchMock);

		const transport = new LankaFetchTransport();

		await expect(
			transport.request("/api", {
				signal: new AbortController().signal,
			}),
		).rejects.toThrow("AbortError");
	});
	it("stress: repeated requests (timing)", async () => {
		const response = makeResponse();
		const fetchMock = vi.fn(async () => response);
		vi.stubGlobal("fetch", fetchMock);

		const transport = new LankaFetchTransport();
		const iterations = 100;

		const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

		const start = now();
		await Promise.all(
			Array.from({ length: iterations }, () =>
				transport.request("/api", {
					method: "GET",
				}),
			),
		);
		const durationMs = now() - start;

		console.info(`LankaFetchTransport request stress duration: ${durationMs.toFixed(2)}ms`);
		expect(fetchMock).toHaveBeenCalledTimes(iterations);
	});
});
