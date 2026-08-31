import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka, type ILankaInstance } from "lanka";
import { LankaFetchJsonRequest, type ILankaTransport } from "lanka/gateway";
import { LankaError } from "lanka/errors";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { lankaHttp } from "../index";

/**
 * Retry multiplies backend load, so every property of it is pinned separately —
 * including exactly how many requests go out.
 */

/** A transport that fails in a given way for the first N calls. */
const flakyTransport = (failures: number, error: () => Error) => {
	const calls: RequestInit[] = [];
	const transport: ILankaTransport<RequestInit> = {
		request: async (_endpoint: string, options?: RequestInit) => {
			calls.push(options ?? {});
			if (calls.length <= failures) throw error();
			return new Response(JSON.stringify({ attempt: calls.length }), {
				headers: { "content-type": "application/json" },
			});
		},
	};
	return { transport, calls };
};

const networkFailure = () => new TypeError("Failed to fetch");
const domainFailure = () => new LankaError({ kind: "domain", message: "not allowed" });

const post = (transport: ILankaTransport<RequestInit>) =>
	new LankaFetchJsonRequest({ transport }).execute("/api/things", { method: "POST" });

const get = (transport: ILankaTransport<RequestInit>) =>
	new LankaFetchJsonRequest({ transport }).execute("/api/things");

describe("@lankajs/plugin-http — retry", () => {
	let lanka: ILankaInstance;

	beforeEach(() => {
		lanka = createLanka({ host: lankaTestHost });
	});

	it("retries a network failure", async () => {
		const { transport, calls } = flakyTransport(2, networkFailure);
		lanka.use(lankaHttp({ retry: { backoffMs: [0, 0, 0] }, idempotency: {} }));

		await expect(post(transport)).resolves.toEqual({ attempt: 3 });
		expect(calls).toHaveLength(3);
	});

	it("does not retry a domain refusal", async () => {
		// The server understood the request and refused deliberately: a retry gives
		// the same refusal, later and with a second request.
		const { transport, calls } = flakyTransport(1, domainFailure);
		lanka.use(lankaHttp({ retry: { backoffMs: [0, 0, 0] }, idempotency: {} }));

		await expect(post(transport)).rejects.toMatchObject({ kind: "domain" });
		expect(calls).toHaveLength(1);
	});

	it("three attempts mean three requests, not seven", async () => {
		// A nested retry — retrying what was already retried — multiplies load by
		// nine rather than three, and only the backend notices.
		const { transport, calls } = flakyTransport(99, networkFailure);
		lanka.use(lankaHttp({ retry: { maxAttempts: 3, backoffMs: [0, 0] }, idempotency: {} }));

		await expect(post(transport)).rejects.toMatchObject({ kind: "network" });
		expect(calls).toHaveLength(3);
	});

	it("only the named statuses are retried", async () => {
		const failWith = (status: number) => () =>
			new LankaError({ kind: "http", message: "no", status });

		const gateway = flakyTransport(1, failWith(503));
		lanka.use(lankaHttp({ retry: { backoffMs: [0], retryStatuses: [503] }, idempotency: {} }));
		await expect(post(gateway.transport)).resolves.toBeDefined();
		expect(gateway.calls).toHaveLength(2);

		const conflict = flakyTransport(1, failWith(409));
		await expect(post(conflict.transport)).rejects.toMatchObject({ status: 409 });
		expect(conflict.calls).toHaveLength(1);
	});

	it("methods outside the list are not retried", async () => {
		const { transport, calls } = flakyTransport(1, networkFailure);
		lanka.use(lankaHttp({ retry: { methods: ["GET"], backoffMs: [0] } }));

		await expect(post(transport)).rejects.toMatchObject({ kind: "network" });
		expect(calls).toHaveLength(1);
	});

	it("a first-attempt success is not delayed by a backoff", async () => {
		const { transport, calls } = flakyTransport(0, networkFailure);
		lanka.use(lankaHttp({ retry: { backoffMs: [10_000] }, idempotency: {} }));

		await expect(post(transport)).resolves.toBeDefined();
		expect(calls).toHaveLength(1);
	});

	it("the attempt number is visible to the next in the chain", async () => {
		// The one counting must tell its own attempt from someone else's restart: an
		// auth refresh also runs the request again.
		const seen: number[] = [];
		lanka.use(lankaHttp({ retry: { backoffMs: [0, 0] }, idempotency: {} }));
		lanka.useRequestMiddleware((ctx, next) => {
			seen.push(ctx.attempt);
			return next(ctx);
		});
		const { transport } = flakyTransport(2, networkFailure);

		await post(transport);

		expect(seen).toEqual([1, 2, 3]);
	});

	it("retry without idempotency is rejected AT BUILD TIME", () => {
		// Not at runtime on the first retry: a bug that waits for a network failure
		// to appear waits for the worst possible moment.
		expect(() => lankaHttp({ retry: { maxAttempts: 3 } })).toThrow(/idempotency/i);
	});

	it("retrying safe methods only is allowed without a key", () => {
		// The only legal way to enable retry without idempotency: GET creates
		// nothing, and a second identical request creates no second object.
		expect(() => lankaHttp({ retry: { methods: ["GET"] } })).not.toThrow();
	});

	it("GET is retried without any key", async () => {
		const { transport, calls } = flakyTransport(1, networkFailure);
		lanka.use(lankaHttp({ retry: { methods: ["GET"], backoffMs: [0] } }));

		await expect(get(transport)).resolves.toBeDefined();
		expect(calls).toHaveLength(2);
	});

	it("waits between attempts", async () => {
		vi.useFakeTimers();
		try {
			const { transport, calls } = flakyTransport(1, networkFailure);
			lanka.use(lankaHttp({ retry: { backoffMs: [50] }, idempotency: {} }));

			const pending = post(transport);
			await vi.advanceTimersByTimeAsync(0);
			expect(calls).toHaveLength(1);

			await vi.advanceTimersByTimeAsync(50);
			await pending;
			expect(calls).toHaveLength(2);
		} finally {
			vi.useRealTimers();
		}
	});
});
