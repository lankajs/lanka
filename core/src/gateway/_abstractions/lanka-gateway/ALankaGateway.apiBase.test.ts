import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALankaGateway } from "./ALankaGateway";
import { ALankaRequest } from "../../request/_abstractions/lanka-request/ALankaRequest";
import { createLankaGateway } from "../../_factories/create-lanka-gateway/createLankaGateway";
import { createLanka } from "../../../bootstrap/_factories/create-lanka/createLanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import type { ILankaHost } from "../../../config/_interfaces/ILankaHost";

/**
 * The API base URL from the host contract reaches the request.
 *
 * ## Why a separate test
 *
 * The other `endpoint()` tests use an empty `apiBaseUrl` — they are about joining
 * `basePath` with a method path, where a base URL would only make the
 * expectations harder to read. But a field declared in the contract and used by
 * nobody is a declaration nothing is built from: free to diverge from behaviour,
 * with nobody noticing.
 *
 * What is checked here is exactly the link: what the host said is what reached
 * the transport.
 */

type TOptions = { method?: string };

class SpyRequest extends ALankaRequest<TOptions> {
	public readonly seen: string[] = [];

	constructor() {
		super({});
	}

	protected request<TReturn = Response>(endpoint: string): Promise<TReturn> {
		this.seen.push(endpoint);
		return Promise.resolve(undefined as TReturn);
	}
}

/** No `basePath` at all — an application whose gateway addresses the base itself. */
class RootGateway extends ALankaGateway<TOptions> {
	readonly spy: SpyRequest;

	constructor(spy: SpyRequest) {
		super({ request: spy });
		this.spy = spy;
	}

	root(): Promise<unknown> {
		return this.request("");
	}

	escaping(): Promise<unknown> {
		// A leading slash ESCAPES `basePath` — and still takes the base URL.
		return this.request("/health");
	}
}

class ThingsGateway extends ALankaGateway<TOptions> {
	// No parameter property: `erasableSyntaxOnly` forbids them — syntax that
	// cannot simply be erased requires a bundler to understand TypeScript rather
	// than just strip types.
	readonly spy: SpyRequest;

	constructor(spy: SpyRequest) {
		super({ request: spy, basePath: "/things" });
		this.spy = spy;
	}

	list(): Promise<unknown> {
		return this.request("");
	}

	byId(id: number): Promise<unknown> {
		return this.request(`${id}`);
	}

	elsewhere(): Promise<unknown> {
		return this.request("https://other.example.test/health");
	}

	// The documented idiom: `request()` resolves its argument through `endpoint()`
	// itself, so this resolves twice.
	listThroughEndpoint(): Promise<unknown> {
		return this.request(this.endpoint());
	}

	byIdThroughEndpoint(id: number): Promise<unknown> {
		return this.request(this.endpoint(`${id}`));
	}

	searchThroughEndpoint(query: string): Promise<unknown> {
		return this.request(this.endpoint(`?${query}`));
	}
}

/** Any `basePath`, and a method path given either way. */
class PathGateway extends ALankaGateway<TOptions> {
	readonly spy: SpyRequest;

	constructor(spy: SpyRequest, basePath: string) {
		super({ request: spy, basePath });
		this.spy = spy;
	}

	direct(path: string): Promise<unknown> {
		return this.request(path);
	}

	throughEndpoint(path: string): Promise<unknown> {
		return this.request(this.endpoint(path));
	}

	resolve(path?: string): string {
		return this.endpoint(path);
	}
}

const hostWith = (apiBaseUrl: string): ILankaHost => ({ ...lankaTestHost, apiBaseUrl });

describe("apiBaseUrl from the host contract", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("is prefixed to the method path", async () => {
		createLanka({ host: hostWith("https://api.example.test") });
		const spy = new SpyRequest();
		const gateway = new ThingsGateway(spy);

		await gateway.list();
		await gateway.byId(7);

		expect(spy.seen).toEqual([
			"https://api.example.test/things",
			"https://api.example.test/things/7",
		]);
	});

	it("a trailing slash does not produce a double slash", async () => {
		createLanka({ host: hostWith("https://api.example.test/") });
		const spy = new SpyRequest();

		await new ThingsGateway(spy).list();

		expect(spy.seen[0]).toBe("https://api.example.test/things");
	});

	it("an empty base leaves the path relative", async () => {
		// How an application calling its own origin lives: no base URL is needed,
		// and substituting one would be harmful.
		createLanka({ host: hostWith("") });
		const spy = new SpyRequest();

		await new ThingsGateway(spy).list();

		expect(spy.seen[0]).toBe("/things");
	});

	it("an absolute method URL is left untouched", async () => {
		// A method calling another host is not asked for a base URL.
		createLanka({ host: hostWith("https://api.example.test") });
		const spy = new SpyRequest();

		await new ThingsGateway(spy).elsewhere();

		expect(spy.seen[0]).toBe("https://other.example.test/health");
	});

	it("two instances call their own base URLs", async () => {
		const first = createLanka({ host: hostWith("https://first.example.test") });
		const firstSpy = new SpyRequest();
		first.activate();
		await new ThingsGateway(firstSpy).list();

		const second = createLanka({ host: hostWith("https://second.example.test") });
		const secondSpy = new SpyRequest();
		second.activate();
		await new ThingsGateway(secondSpy).list();

		expect(firstSpy.seen[0]).toBe("https://first.example.test/things");
		expect(secondSpy.seen[0]).toBe("https://second.example.test/things");
	});
	it("with no basePath, an empty method path addresses the base itself", async () => {
		// `basePath` defaults to empty, so there is nothing to join — the request
		// must be the base URL and not the empty string, which is what a missing
		// `if (!path) return base` would produce.
		createLanka({ host: hostWith("https://api.example.test") });
		const spy = new SpyRequest();

		await new RootGateway(spy).root();

		expect(spy.seen[0]).toBe("https://api.example.test");
	});

	it("a leading slash escapes basePath and still takes the base URL", async () => {
		// The two rules compose: the slash means "not under basePath", it does not
		// mean "not on this API".
		createLanka({ host: hostWith("https://api.example.test") });
		const spy = new SpyRequest();

		await new RootGateway(spy).escaping();

		expect(spy.seen[0]).toBe("https://api.example.test/health");
	});
});

/**
 * Issue #7: every gateway in the guide writes `request(endpoint(…))`, and
 * `request()` resolves through `endpoint()` again. An absolute base survives
 * that — the first pass makes an absolute URL, which the second leaves alone —
 * so the defect hid until an application moved its API under a RELATIVE base,
 * and then every request went to `/api/api/…`: a 404 three layers from the cause.
 */
describe("a relative apiBaseUrl and the documented request(endpoint(…)) idiom", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("applies the base once, not twice", async () => {
		createLanka({ host: hostWith("/api") });
		const spy = new SpyRequest();
		const gateway = new ThingsGateway(spy);

		await gateway.listThroughEndpoint();
		await gateway.byIdThroughEndpoint(7);
		await gateway.searchThroughEndpoint("q=open");

		expect(spy.seen).toEqual(["/api/things", "/api/things/7", "/api/things?q=open"]);
	});

	it("reaches the same URL as passing the path to request() directly", async () => {
		createLanka({ host: hostWith("/api") });
		const spy = new SpyRequest();
		const gateway = new ThingsGateway(spy);

		await gateway.list();
		await gateway.listThroughEndpoint();
		await gateway.byId(7);
		await gateway.byIdThroughEndpoint(7);

		expect(spy.seen).toEqual(["/api/things", "/api/things", "/api/things/7", "/api/things/7"]);
	});

	it("does so in the factory style too", async () => {
		createLanka({ host: hostWith("/api") });
		const spy = new SpyRequest();
		const gateway = createLankaGateway({
			request: spy,
			basePath: "/things",
			methods: ({ endpoint, request }) => ({
				list: () => request(endpoint()),
				byId: (id: number) => request(endpoint(String(id))),
			}),
		});

		await gateway.list();
		await gateway.byId(7);

		expect(spy.seen).toEqual(["/api/things", "/api/things/7"]);
	});

	it("endpoint() is idempotent under any base, any basePath and any path", () => {
		const spy = new SpyRequest();
		const bases = [
			"",
			"/",
			"api",
			"/api",
			"/api/",
			"/api/v2",
			"//cdn.example.test/api",
			"https://api.example.test",
		];
		const basePaths = ["/things", "", "/api/v1", "/api-keys"];
		const paths = [
			undefined,
			"",
			"7",
			"7/tags",
			"/health",
			"?q=1",
			"/api?q=1",
			"https://other.example.test/x",
		];

		for (const base of bases) {
			createLanka({ host: hostWith(base) });

			for (const basePath of basePaths) {
				const gateway = new PathGateway(spy, basePath);

				for (const path of paths) {
					const once = gateway.resolve(path);
					expect(
						gateway.resolve(once),
						`base ${JSON.stringify(base)}, basePath ${JSON.stringify(basePath)}, path ${JSON.stringify(path)}`,
					).toBe(once);
				}
			}
		}
	});

	it("a base without a leading slash is applied once too", async () => {
		// `api/things` does not start with a slash, so the second pass used to
		// join it under `basePath` as if it were a method path:
		// `api/things/api/things`.
		createLanka({ host: hostWith("api") });
		const spy = new SpyRequest();
		const gateway = new PathGateway(spy, "/things");

		await gateway.throughEndpoint("");
		await gateway.throughEndpoint("7");

		expect(spy.seen).toEqual(["api/things", "api/things/7"]);
	});

	it("matches the base as a whole segment, not as a prefix", async () => {
		// `/api-keys` starts with `/api` and is not under it. A substring test
		// would take it for already resolved and send the request to `/api-keys`,
		// off the API.
		createLanka({ host: hostWith("/api") });
		const spy = new SpyRequest();
		const gateway = new PathGateway(spy, "");

		await gateway.direct("/api-keys");
		await gateway.throughEndpoint("/api-keys");

		expect(spy.seen).toEqual(["/api/api-keys", "/api/api-keys"]);
	});

	it("a basePath that starts with the base's segment resolves exactly as before", async () => {
		// The check reads the ARGUMENT, not the joined result. Reading the joined
		// result would quietly turn `/api/api/v1` into `/api/v1` for a gateway
		// that never used the idiom — a changed URL in a patch release.
		createLanka({ host: hostWith("/api") });
		const spy = new SpyRequest();
		const gateway = new PathGateway(spy, "/api/v1");

		await gateway.direct("");
		await gateway.direct("7");
		await gateway.throughEndpoint("");
		await gateway.throughEndpoint("7");

		expect(spy.seen).toEqual(["/api/api/v1", "/api/api/v1/7", "/api/api/v1", "/api/api/v1/7"]);
	});

	it("a request middleware sees the URL resolved once", async () => {
		// What the transport and every middleware receive is the finished URL,
		// so a retry or an auth plugin keyed on it sees one spelling, not two.
		const lanka = createLanka({ host: hostWith("/api") });
		const seen: string[] = [];
		lanka.useRequestMiddleware((ctx, next) => {
			seen.push(ctx.endpoint);
			return next(ctx);
		});
		const spy = new SpyRequest();

		await new PathGateway(spy, "/things").throughEndpoint("7");

		expect(seen).toEqual(["/api/things/7"]);
		expect(spy.seen).toEqual(["/api/things/7"]);
	});
});
