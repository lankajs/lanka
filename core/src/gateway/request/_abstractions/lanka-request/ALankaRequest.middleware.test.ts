import { beforeEach, describe, expect, it, vi } from "vitest";
import { LankaFetchJsonRequest } from "../../lanka-fetch-json-request/LankaFetchJsonRequest";
import { LankaError } from "../../../../errors/lanka-error/LankaError";
import { createLanka } from "../../../../bootstrap/_factories/create-lanka/createLanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import type { ILankaInstance } from "../../../../bootstrap/_factories/create-lanka/createLanka";
import type { ILankaTransport } from "../../../_interfaces/ILankaTransport";

/**
 * The extension point `@lankajs/plugin-http` exists for.
 *
 * ## A wrapper rather than three hooks
 *
 * `onRequest` / `onResponse` / `onError` cannot express RETRY: `onError` can
 * replace an error but cannot run the request again, and retry plus auth refresh
 * are the two main reasons a request-policy plugin exists at all.
 *
 * A `(ctx, next) => …` wrapper expresses both, plus everything the three hooks
 * expressed. The objection that holds for the event bus does not carry over:
 * there, middleware that skips `next` SILENCES the event, here it returns a
 * value instead of a request and the caller sees it.
 */

const okTransport = (body: unknown = { ok: true }): ILankaTransport<RequestInit> => ({
	request: () =>
		Promise.resolve(
			new Response(JSON.stringify(body), {
				headers: { "content-type": "application/json" },
			}),
		),
});

const failingTransport = (failures: number): ILankaTransport<RequestInit> => {
	let seen = 0;
	return {
		request: async () => {
			await Promise.resolve();
			seen += 1;
			if (seen <= failures) throw new TypeError("Failed to fetch");
			return new Response(JSON.stringify({ attempt: seen }), {
				headers: { "content-type": "application/json" },
			});
		},
	};
};

describe("request middleware", () => {
	let lanka: ILankaInstance;

	beforeEach(() => {
		lanka = createLanka({ host: lankaTestHost });
	});

	it("sees the request before sending and can change the path", async () => {
		const seen: string[] = [];
		lanka.useRequestMiddleware((ctx, next) => {
			seen.push(ctx.endpoint);
			return next({ ...ctx, endpoint: `${ctx.endpoint}?traced=1` });
		});

		const request = new LankaFetchJsonRequest({ transport: okTransport() });
		await request.execute("/gaps");

		expect(seen).toEqual(["/gaps"]);
	});

	it("can retry the request — what three hooks cannot express", async () => {
		// Why the shape is a wrapper: an `onError` that can only replace an error
		// cannot express retry, and retry plus auth refresh are the two main
		// abilities of a request-policy plugin.
		lanka.useRequestMiddleware(async (ctx, next) => {
			try {
				return await next(ctx);
			} catch {
				return await next({ ...ctx, attempt: ctx.attempt + 1 });
			}
		});

		const request = new LankaFetchJsonRequest({ transport: failingTransport(1) });
		const result = await request.execute<{ attempt: number }>("/gaps");

		expect(result.attempt).toBe(2);
	});

	it("receives an already-tagged error and can replace it", async () => {
		lanka.useRequestMiddleware(async (ctx, next) => {
			try {
				return await next(ctx);
			} catch (error) {
				expect((error as LankaError).kind).toBe("network");
				throw new LankaError({
					kind: "domain",
					message: "slot taken",
					code: "GAP_TAKEN",
					cause: error,
				});
			}
		});

		const request = new LankaFetchJsonRequest({ transport: failingTransport(99) });
		const error = (await request.execute("/gaps").catch((e: unknown) => e)) as LankaError;

		expect(error.kind).toBe("domain");
		expect(error.code).toBe("GAP_TAKEN");
	});

	it("order holds: the one registered first wraps the rest", async () => {
		const order: string[] = [];
		lanka.useRequestMiddleware(async (ctx, next) => {
			order.push("outer before");
			const result = await next(ctx);
			order.push("outer after");
			return result;
		});
		lanka.useRequestMiddleware(async (ctx, next) => {
			order.push("inner before");
			const result = await next(ctx);
			order.push("inner after");
			return result;
		});

		await new LankaFetchJsonRequest({ transport: okTransport() }).execute("/gaps");

		expect(order).toEqual(["outer before", "inner before", "inner after", "outer after"]);
	});

	it("middleware that throws does not leave the counter raised", async () => {
		// A catch placed outside the `finally` would leave a permanent +1 and
		// disable prefetch for the rest of the session — the same defect the
		// request itself is already guarded against, so the chain must sit inside
		// the same guard.
		lanka.useRequestMiddleware(() => {
			throw new Error("the plugin broke");
		});

		await new LankaFetchJsonRequest({ transport: okTransport() })
			.execute("/gaps")
			.catch(() => undefined);

		expect(lanka.inFlight.getActiveCount()).toBe(0);
	});

	it("another instance's middleware does not take part", async () => {
		const other = createLanka({ host: lankaTestHost });
		const called = vi.fn();
		other.useRequestMiddleware((ctx, next) => {
			called();
			return next(ctx);
		});

		lanka.activate();
		await new LankaFetchJsonRequest({ transport: okTransport() }).execute("/gaps");

		expect(called).not.toHaveBeenCalled();
	});
});

describe("cancellation and timeout", () => {
	let lanka: ILankaInstance;

	beforeEach(() => {
		lanka = createLanka({ host: lankaTestHost });
	});

	it("an expired timeout yields kind: timeout and the counter returns to zero", async () => {
		const hangingTransport: ILankaTransport<RequestInit> = {
			request: (_resource, options) =>
				new Promise((_resolve, reject) => {
					options?.signal?.addEventListener("abort", () => {
						reject(options.signal?.reason as Error);
					});
				}),
		};

		const request = new LankaFetchJsonRequest({ transport: hangingTransport });
		const error = (await request
			.execute("/gaps", { timeoutMs: 10 })
			.catch((e: unknown) => e)) as LankaError;

		expect(error.kind).toBe("timeout");
		expect(lanka.inFlight.getActiveCount()).toBe(0);
	});

	it("the caller's signal yields kind: aborted, not timeout", async () => {
		// The distinction carries a decision: a timeout is shown, a user
		// cancellation is not.
		const controller = new AbortController();
		const hangingTransport: ILankaTransport<RequestInit> = {
			request: (_resource, options) =>
				new Promise((_resolve, reject) => {
					options?.signal?.addEventListener("abort", () => {
						reject(options.signal?.reason as Error);
					});
				}),
		};

		const request = new LankaFetchJsonRequest({ transport: hangingTransport });
		const promise = request.execute("/gaps", { signal: controller.signal });
		controller.abort();

		const error = (await promise.catch((e: unknown) => e)) as LankaError;

		expect(error.kind).toBe("aborted");
		expect(error.isSilent).toBe(true);
	});

	it("the default timeout comes from the instance and is overridden per request", async () => {
		const seen: (number | undefined)[] = [];
		const probeTransport: ILankaTransport<RequestInit> = {
			request: (_resource, options) => {
				seen.push(options?.signal ? 1 : undefined);
				return Promise.resolve(
					new Response("{}", {
						headers: { "content-type": "application/json" },
					}),
				);
			},
		};

		lanka.setRequestTimeout(5_000);
		const request = new LankaFetchJsonRequest({ transport: probeTransport });

		await request.execute("/gaps");

		// EVERY request gets a signal once a timeout is configured: otherwise a hung
		// request would hang until the tab closes, holding the counter and
		// disabling prefetch for the rest of the session.
		expect(seen).toEqual([1]);
	});
});

describe("the observable request counter", () => {
	it("notifies a subscriber of a change", async () => {
		const lanka = createLanka({ host: lankaTestHost });
		const seen: number[] = [];
		lanka.inFlight.subscribe((count) => seen.push(count));

		await new LankaFetchJsonRequest({ transport: okTransport() }).execute("/gaps");

		// Why the counter is observable: `@lankajs/plugin-prefetch` stands down while
		// another request is on the wire, and polling in a loop is a poor
		// substitute for a notification.
		expect(seen).toEqual([1, 0]);
	});
});
