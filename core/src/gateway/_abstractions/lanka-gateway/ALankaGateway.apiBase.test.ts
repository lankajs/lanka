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

class GapGateway extends ALankaGateway<TOptions> {
	// No parameter property: `erasableSyntaxOnly` forbids them — syntax that
	// cannot simply be erased requires a bundler to understand TypeScript rather
	// than just strip types.
	readonly spy: SpyRequest;

	constructor(spy: SpyRequest) {
		super({ request: spy, basePath: "/gaps" });
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
		const gateway = new GapGateway(spy);

		await gateway.list();
		await gateway.byId(7);

		expect(spy.seen).toEqual([
			"https://api.example.test/gaps",
			"https://api.example.test/gaps/7",
		]);
	});

	it("a trailing slash does not produce a double slash", async () => {
		createLanka({ host: hostWith("https://api.example.test/") });
		const spy = new SpyRequest();

		await new GapGateway(spy).list();

		expect(spy.seen[0]).toBe("https://api.example.test/gaps");
	});

	it("an empty base leaves the path relative", async () => {
		// How an application calling its own origin lives: no base URL is needed,
		// and substituting one would be harmful.
		createLanka({ host: hostWith("") });
		const spy = new SpyRequest();

		await new GapGateway(spy).list();

		expect(spy.seen[0]).toBe("/gaps");
	});

	it("an absolute method URL is left untouched", async () => {
		// A method calling another host is not asked for a base URL.
		createLanka({ host: hostWith("https://api.example.test") });
		const spy = new SpyRequest();

		await new GapGateway(spy).elsewhere();

		expect(spy.seen[0]).toBe("https://other.example.test/health");
	});

	it("two instances call their own base URLs", async () => {
		const first = createLanka({ host: hostWith("https://first.example.test") });
		const firstSpy = new SpyRequest();
		first.activate();
		await new GapGateway(firstSpy).list();

		const second = createLanka({ host: hostWith("https://second.example.test") });
		const secondSpy = new SpyRequest();
		second.activate();
		await new GapGateway(secondSpy).list();

		expect(firstSpy.seen[0]).toBe("https://first.example.test/gaps");
		expect(secondSpy.seen[0]).toBe("https://second.example.test/gaps");
	});
});
