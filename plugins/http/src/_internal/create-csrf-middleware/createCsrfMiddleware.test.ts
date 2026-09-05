import { beforeEach, describe, expect, it } from "vitest";
import { createLanka } from "lanka";
import { LankaFetchJsonRequest } from "lanka/gateway";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import type { ILankaInstance } from "lanka";
import type { ILankaTransport } from "lanka/gateway";
import { lankaHttp } from "../../index";

/**
 * The first plugin capability exists to answer ONE question: is the shape of
 * core's extension point right? Answering it with six capabilities costs more
 * than with one, so this is the CSRF header alone.
 *
 * If delivering it required touching `ALankaGateway` or the transport, that
 * would not be a reason to extend core along the way but a result: the point is
 * designed wrong. It did not.
 */

/** A transport that records what it was called with. */
const recordingTransport = () => {
	const calls: { endpoint: string; options: RequestInit | undefined }[] = [];
	const transport: ILankaTransport<RequestInit> = {
		request: (endpoint: string, options?: RequestInit) => {
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

const headerOf = (options: RequestInit | undefined, name: string): string | null =>
	new Headers(options?.headers).get(name);

describe("@lankajs/plugin-http — the CSRF header", () => {
	let lanka: ILankaInstance;

	beforeEach(() => {
		lanka = createLanka({ host: lankaTestHost });
	});

	it("reaches the transport on an unsafe method", async () => {
		const { transport, calls } = recordingTransport();
		lanka.use(lankaHttp({ csrf: { header: "X-CSRF-Protection", value: "1" } }));

		await new LankaFetchJsonRequest({ transport }).execute("/api/things", {
			method: "POST",
		});

		expect(headerOf(calls[0]?.options, "X-CSRF-Protection")).toBe("1");
	});

	it("is not added to a read", async () => {
		// GET changes nothing, and requiring the header on it breaks link navigation
		// for protection with nothing to protect.
		const { transport, calls } = recordingTransport();
		lanka.use(lankaHttp({ csrf: { header: "X-CSRF-Protection", value: "1" } }));

		await new LankaFetchJsonRequest({ transport }).execute("/api/things");

		expect(headerOf(calls[0]?.options, "X-CSRF-Protection")).toBeNull();
	});

	it("does not overwrite headers the request brought", async () => {
		// Replacing the headers wholesale would silently drop `content-type`, and
		// the server would read the body wrongly — or not at all.
		const { transport, calls } = recordingTransport();
		lanka.use(lankaHttp({ csrf: { header: "X-CSRF-Protection", value: "1" } }));

		await new LankaFetchJsonRequest({ transport }).execute("/api/things", {
			method: "POST",
			headers: { "content-type": "application/json", "x-trace": "abc" },
		});

		expect(headerOf(calls[0]?.options, "content-type")).toBe("application/json");
		expect(headerOf(calls[0]?.options, "x-trace")).toBe("abc");
		expect(headerOf(calls[0]?.options, "X-CSRF-Protection")).toBe("1");
	});

	it("the method list is configurable", async () => {
		const { transport, calls } = recordingTransport();
		lanka.use(lankaHttp({ csrf: { header: "X-Guard", value: "on", methods: ["GET"] } }));

		await new LankaFetchJsonRequest({ transport }).execute("/api/things");

		expect(headerOf(calls[0]?.options, "X-Guard")).toBe("on");
	});

	it("without CSRF configuration the plugin adds nothing", async () => {
		// A plugin with no configuration must be NOTHING: registering it and
		// silently getting a header nobody asked for is the worst kind of default.
		const { transport, calls } = recordingTransport();
		lanka.use(lankaHttp());

		await new LankaFetchJsonRequest({ transport }).execute("/api/things", {
			method: "POST",
		});

		expect([...new Headers(calls[0]?.options?.headers).keys()]).toEqual([]);
	});

	it("removing the plugin removes the header too", async () => {
		const { transport, calls } = recordingTransport();
		const remove = lanka.use(lankaHttp({ csrf: { header: "X-CSRF-Protection", value: "1" } }));

		remove();
		await new LankaFetchJsonRequest({ transport }).execute("/api/things", {
			method: "POST",
		});

		expect(headerOf(calls[0]?.options, "X-CSRF-Protection")).toBeNull();
	});

	it("registering twice is rejected loudly", async () => {
		// Two copies of one policy means doubled retries and two idempotency keys
		// per request. That shows up only as backend load — much later, and to
		// somebody else.
		lanka.use(lankaHttp({ csrf: { header: "X-CSRF-Protection", value: "1" } }));

		expect(() => lanka.use(lankaHttp({ csrf: { header: "X-Other", value: "2" } }))).toThrow(
			/already registered/i,
		);

		const { transport, calls } = recordingTransport();
		await new LankaFetchJsonRequest({ transport }).execute("/api/things", {
			method: "POST",
		});

		expect(headerOf(calls[0]?.options, "X-Other")).toBeNull();
	});
});

describe("@lankajs/plugin-http — where the CSRF header may go", () => {
	let lanka: ILankaInstance;

	beforeEach(() => {
		lanka = createLanka({ host: lankaTestHost });
	});

	const post = (transport: ILankaTransport<RequestInit>, endpoint: string) =>
		new LankaFetchJsonRequest({ transport }).execute(endpoint, { method: "POST" });

	it("reaches the API's own origin", async () => {
		const { transport, calls } = recordingTransport();
		lanka.use(lankaHttp({ csrf: { header: "X-CSRF-Protection", value: "1" } }));

		await post(transport, `${lankaTestHost.apiBaseUrl}/things`);

		expect(headerOf(calls[0]?.options, "X-CSRF-Protection")).toBe("1");
	});

	// The token is a secret shared with one server. A gateway writing the whole
	// URL of a file host or a payment provider used to carry it there, handing a
	// third party the one thing standing between a live cookie and a forged
	// request.
	it("is NOT sent to a third party's origin", async () => {
		const { transport, calls } = recordingTransport();
		lanka.use(lankaHttp({ csrf: { header: "X-CSRF-Protection", value: "1" } }));

		await post(transport, "https://uploads.example.net/files");

		expect(headerOf(calls[0]?.options, "X-CSRF-Protection")).toBeNull();
	});

	it("is not sent to a protocol-relative address either", async () => {
		const { transport, calls } = recordingTransport();
		lanka.use(lankaHttp({ csrf: { header: "X-CSRF-Protection", value: "1" } }));

		await post(transport, "//uploads.example.net/files");

		expect(headerOf(calls[0]?.options, "X-CSRF-Protection")).toBeNull();
	});

	it("reaches an origin the configuration names", async () => {
		const { transport, calls } = recordingTransport();
		lanka.use(
			lankaHttp({
				csrf: {
					header: "X-CSRF-Protection",
					value: "1",
					origins: ["https://billing.example.com"],
				},
			}),
		);

		await post(transport, "https://billing.example.com/invoices");

		expect(headerOf(calls[0]?.options, "X-CSRF-Protection")).toBe("1");
	});
});
