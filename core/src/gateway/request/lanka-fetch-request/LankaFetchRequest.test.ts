import { describe, expect, it, vi } from "vitest";
import { LankaFetchRequest } from "./LankaFetchRequest";

const makeResponse = (status: number): Response => new Response("ok", { status });

describe("LankaFetchRequest", () => {
	it("uses mock handler when useMock is true", async () => {
		const transport = {
			request: vi.fn(async () => makeResponse(200)),
		};
		const request = new LankaFetchRequest({
			transport,
			useMock: true,
		});
		const mockHandler = vi.fn(async () => makeResponse(201));

		const res = await request.execute("/api", {}, mockHandler);

		expect(res.status).toBe(201);
		expect(mockHandler).toHaveBeenCalledOnce();
		expect(transport.request).not.toHaveBeenCalled();
	});

	it("calls transport and returns response when ok", async () => {
		const response = makeResponse(200);
		const transport = {
			request: vi.fn(async () => response),
		};
		const request = new LankaFetchRequest({ transport });

		const res = await request.execute("/api", {
			method: "GET",
		});

		expect(res).toBe(response);
		expect(transport.request).toHaveBeenCalledWith("/api", {
			method: "GET",
		});
	});

	it("uses transport when useMock is true but no mock handler provided", async () => {
		const response = makeResponse(200);
		const transport = {
			request: vi.fn(async () => response),
		};
		const request = new LankaFetchRequest({
			transport,
			useMock: true,
		});

		const res = await request.execute("/api", {
			method: "GET",
		});

		expect(res).toBe(response);
		expect(transport.request).toHaveBeenCalledWith("/api", {
			method: "GET",
		});
	});

	it("a failure is parsed by the default handler even when none was provided", async () => {
		// The default lives here rather than on the gateway, where it would sit in a
		// field nobody reads. The response body is the only description of the
		// failure there is, so it becomes the message; the host's text remains for
		// the case where there is no body at all.
		const transport = {
			request: vi.fn(async () => makeResponse(500)),
		};
		const request = new LankaFetchRequest({ transport });

		await expect(request.execute("/api")).rejects.toMatchObject({
			kind: "http",
			status: 500,
			message: "ok",
		});
	});

	it("delegates to errorHandler when response is not ok", async () => {
		const transport = {
			request: vi.fn(async () => makeResponse(400)),
		};
		const errorHandler = vi.fn(async () => {
			throw new Error("Handled");
		});
		const request = new LankaFetchRequest({
			transport,
			errorHandler,
		});

		await expect(request.execute("/api")).rejects.toThrow("Handled");
		expect(errorHandler).toHaveBeenCalledOnce();
	});
	it("stress: repeated execute calls (timing)", async () => {
		const response = makeResponse(200);
		const transport = {
			request: vi.fn(async () => response),
		};
		const request = new LankaFetchRequest({ transport });
		const iterations = 200;

		const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

		const start = now();
		await Promise.all(
			Array.from({ length: iterations }, () => request.execute("/api", { method: "GET" })),
		);
		const durationMs = now() - start;

		console.info(`LankaFetchRequest execute stress duration: ${durationMs.toFixed(2)}ms`);
		expect(transport.request).toHaveBeenCalledTimes(iterations);
	});
});
