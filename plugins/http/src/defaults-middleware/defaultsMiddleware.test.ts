import { beforeEach, describe, expect, it } from "vitest";
import { createLanka } from "lanka";
import { LankaFetchJsonRequest } from "lanka/gateway";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import type { ILankaInstance } from "lanka";
import type { ILankaTransport, TLankaRequestInit } from "lanka/gateway";
import { lankaHttp, lankaCookieSessionPolicy, lankaTokenSessionPolicy } from "../index";

/** A transport that records what it was called with. */
const recordingTransport = () => {
	const calls: { endpoint: string; options: TLankaRequestInit | undefined }[] = [];
	const transport: ILankaTransport = {
		request: (endpoint: string, options?: TLankaRequestInit) => {
			calls.push({ endpoint, options });
			return Promise.resolve(
				new Response(JSON.stringify({ ok: true }), {
					headers: { "content-type": "application/json" },
				}),
			);
		},
	};
	return { transport, calls };
};

const headerOf = (options: TLankaRequestInit | undefined, name: string): string | null =>
	new Headers(options?.headers).get(name);

describe("@lankajs/plugin-http — what every request carries", () => {
	let lanka: ILankaInstance;

	beforeEach(() => {
		lanka = createLanka({ host: lankaTestHost });
	});

	describe("credentials", () => {
		it("reaches the transport", async () => {
			const { transport, calls } = recordingTransport();
			lanka.use(lankaHttp({ defaults: { credentials: "include" } }));

			await new LankaFetchJsonRequest({ transport }).execute("/api/things");

			expect(calls[0]?.options?.credentials).toBe("include");
		});

		it("reaches a call that passed NO options at all", async () => {
			// The case the whole field exists for. `getMe()` writes
			// `this.request("me")` and core passes `undefined` options through
			// untouched — and `GET /users/me` is exactly the request that needs the
			// cookie. A middleware that preserved `undefined` here would set the
			// credential on every request except the ones that carry a session.
			const { transport, calls } = recordingTransport();
			lanka.use(lankaHttp({ defaults: { credentials: "include" } }));

			await new LankaFetchJsonRequest({ transport }).execute("/api/things");

			expect(calls[0]?.options).toBeDefined();
			expect(calls[0]?.options?.credentials).toBe("include");
		});

		it("does not beat a call that asked for something else", async () => {
			// A health check or a call to a third party means `"omit"`, and a default
			// that overrode it would send the session cookie to whoever that is.
			const { transport, calls } = recordingTransport();
			lanka.use(lankaHttp({ defaults: { credentials: "include" } }));

			await new LankaFetchJsonRequest({ transport }).execute("/api/ping", {
				credentials: "omit",
			});

			expect(calls[0]?.options?.credentials).toBe("omit");
		});

		it("is absent when nothing configured it", async () => {
			const { transport, calls } = recordingTransport();
			lanka.use(lankaHttp());

			await new LankaFetchJsonRequest({ transport }).execute("/api/things");

			expect(calls[0]?.options?.credentials).toBeUndefined();
		});
	});

	describe("headers", () => {
		it("adds what every request carries", async () => {
			const { transport, calls } = recordingTransport();
			lanka.use(
				lankaHttp({
					defaults: { headers: { Accept: "application/json", "x-client": "web/2.1" } },
				}),
			);

			await new LankaFetchJsonRequest({ transport }).execute("/api/things");

			expect(headerOf(calls[0]?.options, "accept")).toBe("application/json");
			expect(headerOf(calls[0]?.options, "x-client")).toBe("web/2.1");
		});

		it("loses to the call, which is the more specific statement", async () => {
			const { transport, calls } = recordingTransport();
			lanka.use(lankaHttp({ defaults: { headers: { Accept: "application/json" } } }));

			await new LankaFetchJsonRequest({ transport }).execute("/api/export", {
				headers: { accept: "text/csv" },
			});

			// Set once, not twice: `Headers` normalises the name, so the default
			// written `Accept` and the call's `accept` are one header and the server
			// is not left picking between two.
			expect(headerOf(calls[0]?.options, "accept")).toBe("text/csv");
		});

		it("keeps a header another middleware already set", async () => {
			// Defaults are registered innermost, so they run after CSRF and after the
			// idempotency key. Filling gaps from the inside is the only order in which
			// "a default" is true.
			const { transport, calls } = recordingTransport();
			lanka.use(
				lankaHttp({
					csrf: { header: "x-csrf", value: "t" },
					defaults: { headers: { Accept: "application/json" } },
				}),
			);

			await new LankaFetchJsonRequest({ transport }).execute("/api/things", {
				method: "POST",
			});

			expect(headerOf(calls[0]?.options, "x-csrf")).toBe("t");
			expect(headerOf(calls[0]?.options, "accept")).toBe("application/json");
		});

		it("skips a value that is undefined rather than sending the word", async () => {
			const { transport, calls } = recordingTransport();
			lanka.use(lankaHttp({ defaults: { headers: { "x-build": undefined } } }));

			await new LankaFetchJsonRequest({ transport }).execute("/api/things");

			expect(headerOf(calls[0]?.options, "x-build")).toBeNull();
		});

		it("reads a FUNCTION once per attempt, so a rotated value travels", async () => {
			// The reason a function is accepted at all: a value that is only true
			// right now — a context flag, a token rotated mid-session. Read once at
			// registration, a retry would carry the value the first attempt was built
			// with.
			const { transport, calls } = recordingTransport();
			let trigger = "user";
			lanka.use(lankaHttp({ defaults: { headers: () => ({ "x-trigger": trigger }) } }));

			const request = new LankaFetchJsonRequest({ transport });
			await request.execute("/api/things");
			trigger = "sse";
			await request.execute("/api/things");

			expect(headerOf(calls[0]?.options, "x-trigger")).toBe("user");
			expect(headerOf(calls[1]?.options, "x-trigger")).toBe("sse");
		});
	});

	describe("the presets", () => {
		it("a cookie session SENDS the cookie", async () => {
			// It used to set the CSRF header and leave `credentials` alone, which is
			// a proof of origin attached to an unauthenticated request: `fetch`
			// defaults to `"same-origin"`, and an API on another host got nothing.
			const { transport, calls } = recordingTransport();
			lanka.use(lankaHttp(lankaCookieSessionPolicy({ csrf: { header: "x", value: "y" } })));

			await new LankaFetchJsonRequest({ transport }).execute("/api/things");

			expect(calls[0]?.options?.credentials).toBe("include");
		});

		it("a cookie session takes headers beside the cookie", async () => {
			const { transport, calls } = recordingTransport();
			lanka.use(
				lankaHttp(
					lankaCookieSessionPolicy({
						csrf: { header: "x", value: "y" },
						defaults: { headers: { "x-client": "web" } },
					}),
				),
			);

			await new LankaFetchJsonRequest({ transport }).execute("/api/things");

			expect(headerOf(calls[0]?.options, "x-client")).toBe("web");
			// The preset's own default survives a consumer adding to the section.
			expect(calls[0]?.options?.credentials).toBe("include");
		});

		it("a same-origin deployment may narrow it", async () => {
			const { transport, calls } = recordingTransport();
			lanka.use(
				lankaHttp(
					lankaCookieSessionPolicy({
						csrf: { header: "x", value: "y" },
						defaults: { credentials: "same-origin" },
					}),
				),
			);

			await new LankaFetchJsonRequest({ transport }).execute("/api/things");

			expect(calls[0]?.options?.credentials).toBe("same-origin");
		});

		it("a token session sends no credential, because there is no cookie", async () => {
			const { transport, calls } = recordingTransport();
			lanka.use(
				lankaHttp(
					lankaTokenSessionPolicy({ auth: { refreshAuth: () => Promise.resolve(true) } }),
				),
			);

			await new LankaFetchJsonRequest({ transport }).execute("/api/things");

			expect(calls[0]?.options?.credentials).toBeUndefined();
		});
	});

	it("removing the plugin removes the defaults too", async () => {
		const { transport, calls } = recordingTransport();
		const remove = lanka.use(
			lankaHttp({ defaults: { credentials: "include", headers: { "x-client": "web" } } }),
		);

		remove();
		await new LankaFetchJsonRequest({ transport }).execute("/api/things");

		expect(calls[0]?.options?.credentials).toBeUndefined();
		expect(headerOf(calls[0]?.options, "x-client")).toBeNull();
	});
});
