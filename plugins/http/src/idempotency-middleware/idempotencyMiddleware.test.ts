import { beforeEach, describe, expect, it } from "vitest";
import { createLanka, type ILankaInstance } from "lanka";
import { LankaFetchJsonRequest, type ILankaTransport } from "lanka/gateway";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { lankaHttp } from "../index";

/**
 * The idempotency key: what makes retry safer than its absence.
 */

const recordingTransport = (failures = 0) => {
	const keys: (string | null)[] = [];
	const transport: ILankaTransport<RequestInit> = {
		request: async (_endpoint: string, options?: RequestInit) => {
			keys.push(new Headers(options?.headers).get("Idempotency-Key"));
			if (keys.length <= failures) throw new TypeError("Failed to fetch");
			return new Response(JSON.stringify({ ok: true }), {
				headers: { "content-type": "application/json" },
			});
		},
	};
	return { transport, keys };
};

const send = (transport: ILankaTransport<RequestInit>, init?: Omit<RequestInit, "signal">) =>
	new LankaFetchJsonRequest({ transport }).execute("/api/things", {
		method: "POST",
		...init,
	});

describe("@lankajs/plugin-http — the idempotency key", () => {
	let lanka: ILankaInstance;

	beforeEach(() => {
		lanka = createLanka({ host: lankaTestHost });
	});

	it("is added to an unsafe method", async () => {
		const { transport, keys } = recordingTransport();
		lanka.use(lankaHttp({ idempotency: {} }));

		await send(transport);

		expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/i);
	});

	it("is not added to a read", async () => {
		// GET creates nothing: a key there is an extra header and an extra record in
		// the server's idempotency store.
		const { transport, keys } = recordingTransport();
		lanka.use(lankaHttp({ idempotency: {} }));

		await new LankaFetchJsonRequest({ transport }).execute("/api/things");

		expect(keys[0]).toBeNull();
	});

	it("a RETRIED request carries THE SAME key", async () => {
		// The one mistake that makes retry more dangerous than its absence: a new
		// key per attempt reads to the server as a new intent and creates a second
		// object — a payment, an invitation — while the user sees nothing.
		const { transport, keys } = recordingTransport(2);
		lanka.use(lankaHttp({ idempotency: {}, retry: { backoffMs: [0, 0] } }));

		await send(transport);

		expect(keys).toHaveLength(3);
		expect(new Set(keys).size).toBe(1);
	});

	it("two different intents get different keys", async () => {
		// The other side: one key for everything would turn the user's second press
		// into a repeat of the first, and the second action would simply not
		// happen.
		const { transport, keys } = recordingTransport();
		lanka.use(lankaHttp({ idempotency: {} }));

		await send(transport);
		await send(transport);

		expect(keys[0]).not.toBe(keys[1]);
	});

	it("a caller's own key is not overridden", async () => {
		// The caller may have built the key so that repeating the user's GESTURE
		// also counts as the same intent.
		const { transport, keys } = recordingTransport();
		lanka.use(lankaHttp({ idempotency: {} }));

		await send(transport, { headers: { "Idempotency-Key": "caller-own-key" } });

		expect(keys[0]).toBe("caller-own-key");
	});

	it("the header name and how the key is produced are configurable", async () => {
		const keys: (string | null)[] = [];
		const transport: ILankaTransport<RequestInit> = {
			request: (_endpoint: string, options?: RequestInit) => {
				keys.push(new Headers(options?.headers).get("X-Request-Id"));
				return Promise.resolve(
					new Response("{}", { headers: { "content-type": "application/json" } }),
				);
			},
		};
		lanka.use(
			lankaHttp({ idempotency: { header: "X-Request-Id", generateKey: () => "fixed-key" } }),
		);

		await send(transport);

		expect(keys[0]).toBe("fixed-key");
	});

	it("does not overwrite the request's headers", async () => {
		const seen: Headers[] = [];
		const transport: ILankaTransport<RequestInit> = {
			request: (_endpoint: string, options?: RequestInit) => {
				seen.push(new Headers(options?.headers));
				return Promise.resolve(
					new Response("{}", { headers: { "content-type": "application/json" } }),
				);
			},
		};
		lanka.use(lankaHttp({ idempotency: {} }));

		await send(transport, { headers: { "content-type": "application/json" } });

		expect(seen[0]?.get("content-type")).toBe("application/json");
		expect(seen[0]?.get("Idempotency-Key")).not.toBeNull();
	});
});
