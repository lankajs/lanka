import { afterEach, describe, expect, it, vi } from "vitest";
import { LankaFetchTransport } from "./LankaFetchTransport";

const makeResponse = () => new Response("ok", { status: 200 });

/** Stubs `fetch` and hands back what the transport actually called it with. */
const stubFetch = () => {
	const response = makeResponse();
	// Typed with the parameters `fetch` takes, so a scene can read what the
	// transport passed without casting its way to it.
	const fetchMock = vi.fn(async (_resource: RequestInfo, _options?: RequestInit) => response);
	vi.stubGlobal("fetch", fetchMock);

	return {
		response,
		fetchMock,
		lastOptions: (): RequestInit | undefined => fetchMock.mock.calls[0][1],
	};
};

const contentTypeOf = (options: RequestInit | undefined): string | null =>
	new Headers(options?.headers).get("content-type");

describe("LankaFetchTransport", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe("what it does not touch", () => {
		it("passes undefined options through to fetch", async () => {
			const { fetchMock } = stubFetch();

			await new LankaFetchTransport().request("/api");

			expect(fetchMock).toHaveBeenCalledWith("/api", undefined);
		});

		it("passes a body-less request through as the caller assembled it", async () => {
			const { fetchMock } = stubFetch();
			const options = { method: "GET" };

			await new LankaFetchTransport().request("/api", options);

			// The same object, not a copy: a transport that rebuilt it would be free
			// to drop a field nobody noticed it was carrying.
			expect(fetchMock.mock.calls[0][1]).toBe(options);
		});

		it("leaves a string body alone and adds no content-type", async () => {
			const { lastOptions } = stubFetch();

			await new LankaFetchTransport().request("/api", {
				method: "POST",
				body: JSON.stringify({ a: 1 }),
			});

			expect(lastOptions()?.body).toBe(JSON.stringify({ a: 1 }));
			expect(contentTypeOf(lastOptions())).toBeNull();
		});

		it.each([
			["URLSearchParams", new URLSearchParams({ a: "1" })],
			["Blob", new Blob(["x"])],
			["ArrayBuffer", new ArrayBuffer(4)],
			["a typed array", new Uint8Array([1, 2, 3])],
		])("leaves %s alone", async (_name, body) => {
			const { lastOptions } = stubFetch();

			await new LankaFetchTransport().request("/api", { method: "POST", body });

			expect(lastOptions()?.body).toBe(body);
		});

		it("leaves an explicit null body alone", async () => {
			const { lastOptions } = stubFetch();

			await new LankaFetchTransport().request("/api", { method: "POST", body: null });

			expect(lastOptions()?.body).toBeNull();
		});
	});

	describe("JSON, which is anything fetch cannot already send", () => {
		it("encodes a plain object and says so", async () => {
			const { lastOptions } = stubFetch();

			await new LankaFetchTransport().request("/api", {
				method: "POST",
				body: { a: 1 },
			});

			expect(lastOptions()?.body).toBe(JSON.stringify({ a: 1 }));
			expect(contentTypeOf(lastOptions())).toBe("application/json");
		});

		it("encodes an ARRAY body", async () => {
			// The obvious-looking guard is `toString.call(body) === "[object Object]"`,
			// which answers false for an array — and an array then reaches `fetch` as
			// `"1,2,3"`, a body the server reads as text and the author never sees
			// leave. The rule is "not a BodyInit", not "is a plain object".
			const { lastOptions } = stubFetch();

			await new LankaFetchTransport().request("/api", {
				method: "POST",
				body: [1, 2, 3],
			});

			expect(lastOptions()?.body).toBe("[1,2,3]");
			expect(contentTypeOf(lastOptions())).toBe("application/json");
		});

		it("does NOT overwrite a content-type the caller chose", async () => {
			const { lastOptions } = stubFetch();

			await new LankaFetchTransport().request("/api", {
				method: "PATCH",
				headers: { "content-type": "application/merge-patch+json" },
				body: { a: 1 },
			});

			expect(contentTypeOf(lastOptions())).toBe("application/merge-patch+json");
			expect(lastOptions()?.body).toBe(JSON.stringify({ a: 1 }));
		});

		it("keeps the caller's other headers", async () => {
			const { lastOptions } = stubFetch();

			await new LankaFetchTransport().request("/api", {
				method: "POST",
				headers: new Headers({ "x-idempotency-key": "k-1" }),
				body: { a: 1 },
			});

			const headers = new Headers(lastOptions()?.headers);
			expect(headers.get("x-idempotency-key")).toBe("k-1");
			expect(headers.get("content-type")).toBe("application/json");
		});
	});

	describe("multipart", () => {
		it("removes a content-type the caller set, so the boundary survives", async () => {
			const { lastOptions } = stubFetch();
			const body = new FormData();
			body.append("file", "x");

			await new LankaFetchTransport().request("/api", {
				method: "POST",
				headers: { "content-type": "multipart/form-data" },
				body,
			});

			expect(contentTypeOf(lastOptions())).toBeNull();
			expect(lastOptions()?.body).toBe(body);
		});

		it("keeps every other header while removing that one", async () => {
			const { lastOptions } = stubFetch();

			await new LankaFetchTransport().request("/api", {
				method: "POST",
				headers: { "content-type": "multipart/form-data", "x-csrf": "t" },
				body: new FormData(),
			});

			const headers = new Headers(lastOptions()?.headers);
			expect(headers.get("content-type")).toBeNull();
			expect(headers.get("x-csrf")).toBe("t");
		});

		it("passes the request through untouched when there are no headers", async () => {
			const { fetchMock } = stubFetch();
			const options = { method: "POST", body: new FormData() };

			await new LankaFetchTransport().request("/api", options);

			expect(fetchMock.mock.calls[0][1]).toBe(options);
		});

		it("shares one transport with JSON, which is why the three collapsed into one", async () => {
			// A gateway with fourteen JSON endpoints and one upload could not express
			// the upload while the encoding was fixed in its constructor.
			const { fetchMock } = stubFetch();
			const transport = new LankaFetchTransport();
			const body = new FormData();

			await transport.request("/api/things", { method: "POST", body: { a: 1 } });
			await transport.request("/api/things/avatar", { method: "POST", body });

			const calls = fetchMock.mock.calls;
			expect(new Headers(calls[0][1]?.headers).get("content-type")).toBe("application/json");
			expect(calls[1][1]?.body).toBe(body);
		});
	});

	describe("what it refuses to decide", () => {
		it("returns non-ok responses without throwing", async () => {
			const response = new Response("fail", { status: 500 });
			vi.stubGlobal(
				"fetch",
				vi.fn(async () => response),
			);

			const res = await new LankaFetchTransport().request("/api", { method: "GET" });

			expect(res).toBe(response);
			expect(res.ok).toBe(false);
		});

		it("propagates what fetch threw, naming nothing", async () => {
			const error = new Error("AbortError");
			error.name = "AbortError";
			vi.stubGlobal(
				"fetch",
				vi.fn(async () => {
					throw error;
				}),
			);

			await expect(
				new LankaFetchTransport().request("/api", {
					signal: new AbortController().signal,
				}),
			).rejects.toThrow("AbortError");
		});
	});

	it("encodes each of a hundred concurrent requests independently", async () => {
		const { fetchMock } = stubFetch();
		const transport = new LankaFetchTransport();
		const iterations = 100;

		await Promise.all(
			Array.from({ length: iterations }, (_unused, index) =>
				transport.request("/api", { method: "POST", body: { index } }),
			),
		);

		expect(fetchMock).toHaveBeenCalledTimes(iterations);
		const bodies = fetchMock.mock.calls.map((call) => call[1]?.body);
		expect(new Set(bodies).size).toBe(iterations);
	});
});
