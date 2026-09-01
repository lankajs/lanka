import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALankaGateway } from "./ALankaGateway";
import { ALankaRequest } from "../../request/_abstractions/lanka-request/ALankaRequest";
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
