import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka, type ILankaInstance } from "lanka";
import { LankaFetchJsonRequest, type ILankaTransport } from "lanka/gateway";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { lankaHttp } from "../../index";

/**
 * A request deadline per request CLASS.
 *
 * A file upload and a list read cannot share one value: a deadline fit for a
 * list aborts an upload midway, and one fit for an upload makes the user stare
 * at a hung screen for two minutes.
 */

/** A transport that never answers until aborted by a signal. */
const neverAnswers = () => {
	const signals: (AbortSignal | undefined)[] = [];
	const transport: ILankaTransport<RequestInit> = {
		request: (_endpoint: string, options?: RequestInit) => {
			signals.push(options?.signal ?? undefined);
			return new Promise((_resolve, reject) => {
				options?.signal?.addEventListener("abort", () => {
					reject(new DOMException("aborted", "AbortError"));
				});
			});
		},
	};
	return { transport, signals };
};

const send = (transport: ILankaTransport<RequestInit>, endpoint = "/api/things") =>
	new LankaFetchJsonRequest({ transport }).execute(endpoint);

describe("@lankajs/plugin-http — request lifetime", () => {
	let lanka: ILankaInstance;

	beforeEach(() => {
		lanka = createLanka({ host: lankaTestHost });
	});

	it("aborts the request on its deadline and names it a timeout", async () => {
		vi.useFakeTimers();
		try {
			lanka.use(lankaHttp({ timeout: { defaultTimeoutMs: 100 } }));
			const { transport } = neverAnswers();

			const pending = send(transport);
			const assertion = expect(pending).rejects.toMatchObject({ kind: "timeout" });
			await vi.advanceTimersByTimeAsync(150);
			await assertion;
		} finally {
			vi.useRealTimers();
		}
	});

	it("a request class sets its own deadline", async () => {
		vi.useFakeTimers();
		try {
			lanka.use(
				lankaHttp({
					timeout: {
						defaultTimeoutMs: 100,
						resolveMs: (ctx) => (ctx.endpoint.includes("/upload") ? 5_000 : undefined),
					},
				}),
			);
			const upload = neverAnswers();

			const pending = send(upload.transport, "/api/upload");
			await vi.advanceTimersByTimeAsync(150);
			// A blanket deadline would have expired twice by now — the upload is still
			// running.
			expect(upload.signals[0]?.aborted).toBe(false);

			const assertion = expect(pending).rejects.toMatchObject({ kind: "timeout" });
			await vi.advanceTimersByTimeAsync(5_000);
			await assertion;
		} finally {
			vi.useRealTimers();
		}
	});

	it("a caller-supplied deadline is not overridden by policy", async () => {
		// The caller knows more about their own request than a blanket policy.
		vi.useFakeTimers();
		try {
			lanka.use(lankaHttp({ timeout: { defaultTimeoutMs: 10_000 } }));
			const { transport } = neverAnswers();

			const pending = new LankaFetchJsonRequest({ transport }).execute("/api/things", {
				timeoutMs: 50,
			});
			const assertion = expect(pending).rejects.toMatchObject({ kind: "timeout" });
			await vi.advanceTimersByTimeAsync(80);
			await assertion;
		} finally {
			vi.useRealTimers();
		}
	});

	it("every retry attempt gets ITS OWN full deadline", async () => {
		// One deadline across all attempts would start the third with what the first
		// two left, so the retry aborts before reaching the server.
		vi.useFakeTimers();
		try {
			const started: number[] = [];
			const transport: ILankaTransport<RequestInit> = {
				request: (_endpoint: string, options?: RequestInit) => {
					started.push(Date.now());
					return new Promise((_resolve, reject) => {
						options?.signal?.addEventListener("abort", () => {
							reject(new DOMException("aborted", "AbortError"));
						});
					});
				},
			};
			lanka.use(
				lankaHttp({
					timeout: { defaultTimeoutMs: 100 },
					retry: { maxAttempts: 3, backoffMs: [0, 0], retryKinds: ["timeout"] },
					idempotency: {},
				}),
			);

			const pending = send(transport);
			const assertion = expect(pending).rejects.toMatchObject({ kind: "timeout" });
			await vi.advanceTimersByTimeAsync(1_000);
			await assertion;

			expect(started).toHaveLength(3);
		} finally {
			vi.useRealTimers();
		}
	});

	it("without deadline configuration the policy assigns nothing", async () => {
		// A package assigning a deadline of its own would abort long requests for an
		// application that never asked for one.
		lanka.use(lankaHttp({ csrf: { header: "X-CSRF-Protection", value: "1" } }));
		const { transport, signals } = neverAnswers();

		void send(transport);
		await Promise.resolve();

		expect(signals[0]).toBeUndefined();
	});
});
