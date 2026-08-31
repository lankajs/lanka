import { afterEach, describe, expect, it } from "vitest";
import { resetActiveLanka } from "lanka";
import {
	lankaCookieSessionPolicy,
	lankaSessionDefaults,
	lankaTokenSessionPolicy,
} from "../src/index";
import { createPlaygroundScript, startPlaygroundHttp, startPlaygroundHttpWith } from "./app";

/**
 * The package, used as an application configures it.
 *
 * Every property here needs a whole request to observe: a header no gateway set,
 * a retry no gateway asked for, and a message that came from the backend's own
 * error shape rather than from the framework.
 */
type TPlaygroundHttp = ReturnType<typeof startPlaygroundHttp>;

let app: TPlaygroundHttp | null = null;

afterEach(() => {
	app?.lanka.dispose();
	app = null;
	resetActiveLanka();
});

const headersOf = (options?: RequestInit): Headers => new Headers(options?.headers);

describe("the http playground", () => {
	it("adds the CSRF header to an unsafe method", async () => {
		const script = createPlaygroundScript([200]);
		app = startPlaygroundHttp(script);

		await app.gateway.place();

		expect(headersOf(script.seen[0].options).get("x-csrf")).toBe("playground-token");
	});

	it("leaves a safe method alone", async () => {
		const script = createPlaygroundScript([200]);
		app = startPlaygroundHttp(script);

		await app.gateway.read();

		expect(headersOf(script.seen[0].options).get("x-csrf")).toBeNull();
	});

	it("gives an unsafe request an idempotency key", async () => {
		const script = createPlaygroundScript([200]);
		app = startPlaygroundHttp(script);

		await app.gateway.place();

		expect(headersOf(script.seen[0].options).get("x-idempotency-key")).toBeTruthy();
	});

	it("retries a failure and reuses the SAME key", async () => {
		// The key is what lets the server recognise the retry as the same intent.
		// A new key per attempt is how one order becomes two.
		const script = createPlaygroundScript([500, 200]);
		app = startPlaygroundHttp(script);

		await app.gateway.place();

		expect(script.seen.length).toBeGreaterThan(1);
		expect(headersOf(script.seen[1].options).get("x-idempotency-key")).toBe(
			headersOf(script.seen[0].options).get("x-idempotency-key"),
		);
	});

	it("gives up after the configured number of attempts", async () => {
		const script = createPlaygroundScript([500, 500, 500, 500]);
		app = startPlaygroundHttp(script);

		await expect(app.gateway.place()).rejects.toThrow();
		expect(script.seen).toHaveLength(3);
	});

	it("shows the message this backend puts in `detail`", async () => {
		const script = createPlaygroundScript([400], { detail: "order already placed" });
		app = startPlaygroundHttp(script);

		await expect(app.gateway.place()).rejects.toThrow(/order already placed/);
	});

	it("shows the message this backend puts in field errors", async () => {
		const script = createPlaygroundScript([400], { errors: { quantity: ["too many"] } });
		app = startPlaygroundHttp(script);

		await expect(app.gateway.place()).rejects.toThrow(/too many/);
	});

	it("refuses a retry policy that would repeat unsafe methods unkeyed", () => {
		// Rejected at BUILD time, not on the first retry in production: a bug that
		// waits for a network failure waits for the worst possible moment.
		expect(() =>
			startPlaygroundHttp(createPlaygroundScript([200]), {
				idempotency: undefined,
				retry: { maxAttempts: 3, backoffMs: [0, 0], methods: ["POST"] },
			}),
		).toThrow(/idempotency/);
	});
});

describe("the ready-made policies", () => {
	it("a cookie session proves every unsafe request came from this app", async () => {
		const script = createPlaygroundScript([200]);
		const app = startPlaygroundHttpWith(
			script,
			lankaCookieSessionPolicy({
				csrf: { header: "x-csrf", value: "from-this-app" },
				overrides: { retry: { maxAttempts: 1 }, timeout: { defaultTimeoutMs: 1000 } },
			}),
		);

		await app.gateway.place();

		const headers = new Headers(script.seen.at(-1)?.options?.headers);
		expect(headers.get("x-csrf")).toBe("from-this-app");
		app.lanka.dispose();
	});

	it("and leaves a safe one alone", async () => {
		const script = createPlaygroundScript([200]);
		const app = startPlaygroundHttpWith(
			script,
			lankaCookieSessionPolicy({
				csrf: { header: "x-csrf", value: "from-this-app" },
				overrides: { retry: { maxAttempts: 1 }, timeout: { defaultTimeoutMs: 1000 } },
			}),
		);

		await app.gateway.read();

		// Requiring the header on GET breaks link navigation and protects nothing.
		expect(new Headers(script.seen.at(-1)?.options?.headers).get("x-csrf")).toBe(null);
		app.lanka.dispose();
	});

	it("a token session carries no CSRF header, because nothing attaches a token for you", async () => {
		const script = createPlaygroundScript([200]);
		const app = startPlaygroundHttpWith(
			script,
			lankaTokenSessionPolicy({
				auth: { refreshAuth: () => Promise.resolve(true) },
				overrides: { retry: { maxAttempts: 1 }, timeout: { defaultTimeoutMs: 1000 } },
			}),
		);

		await app.gateway.place();

		expect(new Headers(script.seen.at(-1)?.options?.headers).get("x-csrf")).toBe(null);
		app.lanka.dispose();
	});

	it("both retry the same way, because that half is not about the session", () => {
		const cookie = lankaCookieSessionPolicy({ csrf: { header: "x", value: "y" } });
		const token = lankaTokenSessionPolicy({
			auth: { refreshAuth: () => Promise.resolve(true) },
		});

		expect(cookie.retry).toEqual(token.retry);
		expect(cookie.retry).toEqual(lankaSessionDefaults().retry);
	});

	it("lets a consumer overrule any line of it", () => {
		const policy = lankaCookieSessionPolicy({
			csrf: { header: "x", value: "y" },
			overrides: { timeout: { defaultTimeoutMs: 1 } },
		});

		// The presets remove assembly work; they do not move the choice inside the
		// package.
		expect(policy.timeout?.defaultTimeoutMs).toBe(1);
	});
});
