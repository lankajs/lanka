import { describe, it, expect, vi, beforeEach } from "vitest";
import { ALankaGateway } from "./ALankaGateway";
import type { IALankaGatewayConfig } from "../../_interfaces/IALankaGatewayConfig";
import { ALankaRequest } from "../../request/_abstractions/lanka-request/ALankaRequest";
import { createLanka } from "../../../bootstrap/_factories/create-lanka/createLanka";
import { createLankaHost } from "../../../config/_factories/create-lanka-host/createLankaHost";
import { resetActiveLanka } from "../../../bootstrap/reset-active-lanka/resetActiveLanka";
import type { ILankaInstance } from "../../../bootstrap/_factories/create-lanka/createLanka";

/** A host with an empty base URL: the tests assemble the path themselves. */
const gatewayTestHost = {
	apiBaseUrl: "",
	httpErrorMessage: (status: number) => `status ${status}`,
	networkErrorMessage: () => "network",
	timeoutErrorMessage: () => "timeout",
};

vi.mock("../../../logger/lanka-logger/LankaLogger", () => ({
	lankaLogger: {
		printGatewayLog: vi.fn(),
	},
}));

type TReqOptions = { method?: string; body?: unknown };

class FakeRequest extends ALankaRequest<TReqOptions> {
	public requestFn =
		vi.fn<
			<TReturn = Response>(
				endpoint: string,
				options?: TReqOptions,
				mockHandler?: () => Promise<TReturn>,
			) => Promise<TReturn>
		>();

	constructor() {
		super({});
		this.requestFn.mockResolvedValue({ ok: true });
	}

	protected async request<TReturn = Response>(
		endpoint: string,
		options?: TReqOptions,
		mockHandler?: () => Promise<TReturn>,
	): Promise<TReturn> {
		return (await this.requestFn(endpoint, options, mockHandler)) as TReturn;
	}
}

class TestGateway extends ALankaGateway<TReqOptions> {
	constructor(config: IALankaGatewayConfig<TReqOptions>) {
		super(config);
	}

	public _endpoint(path?: string) {
		return this.endpoint(path ?? "");
	}
	public _request<TReturn = Response>(
		path: string,
		options?: TReqOptions,
		mockHandler?: () => Promise<TReturn>,
	) {
		return this.request<TReturn>(path, options, mockHandler);
	}
	public _getUseMock() {
		return this.useMock;
	}
}

describe("ALankaGateway — useMock resolution priority", () => {
	let request: FakeRequest;
	let lanka: ILankaInstance;

	beforeEach(() => {
		request = new FakeRequest();
		vi.clearAllMocks();
		resetActiveLanka();
		lanka = createLanka({ host: gatewayTestHost });
		lanka.activate();
	});

	it("uses _config.useMock when provided (true)", () => {
		const gw = new TestGateway({
			request,
			basePath: "/api",
			useMock: true,
		});
		expect(gw._getUseMock()).toBe(true);
	});

	it("uses _config.useMock when provided (false)", () => {
		const gw = new TestGateway({
			request,
			basePath: "/api",
			useMock: false,
		});
		expect(gw._getUseMock()).toBe(false);
	});

	it("falls back to infrastructure flags when _config.useMock is undefined", () => {
		lanka.setConfig({ flags: { isMockMode: true } });

		const gw = new TestGateway({ request, basePath: "/api" });
		expect(gw._getUseMock()).toBe(true);
	});
});

describe("ALankaGateway — endpoint()", () => {
	let request: FakeRequest;
	let lanka: ILankaInstance;

	beforeEach(() => {
		request = new FakeRequest();
		vi.clearAllMocks();
		resetActiveLanka();
		lanka = createLanka({ host: gatewayTestHost });
		lanka.activate();
	});

	it("returns basePath when path is empty", () => {
		const gw = new TestGateway({ request, basePath: "/admin/company" });
		expect(gw._endpoint("")).toBe("/admin/company");
		expect(gw._endpoint()).toBe("/admin/company");
	});

	it("returns absolute path as-is if starts with '/'", () => {
		const gw = new TestGateway({ request, basePath: "/admin/company" });
		expect(gw._endpoint("/exact/path")).toBe("/exact/path");
	});

	it("attaches query-only string to basePath if starts with '?'", () => {
		const gw = new TestGateway({ request, basePath: "/admin/company" });
		expect(gw._endpoint("?a=1&b=2")).toBe("/admin/company?a=1&b=2");
	});

	it("joins basePath and relative path with exactly one slash", () => {
		const gw1 = new TestGateway({ request, basePath: "/admin/company" });
		expect(gw1._endpoint("1/user")).toBe("/admin/company/1/user");

		const gw2 = new TestGateway({ request, basePath: "/admin/company/" });
		expect(gw2._endpoint("1/user")).toBe("/admin/company/1/user");

		const gw3 = new TestGateway({ request, basePath: "/admin/company" });
		expect(gw3._endpoint("/1/user")).toBe("/1/user");
	});

	it("handles empty basePath with relative path", () => {
		const gw = new TestGateway({ request, basePath: "" });
		expect(gw._endpoint("health")).toBe("/health");
	});
});

describe("a host with no base URL", () => {
	class BareGateway extends ALankaGateway {
		constructor() {
			super({ basePath: "/todos" });
		}

		at(path?: string): string {
			return this.endpoint(path);
		}
	}

	let instance: ILankaInstance;

	beforeEach(() => {
		resetActiveLanka();
		instance = createLanka({ host: createLankaHost() });
		instance.activate();
	});

	// The case for an optional base URL: an application on its API's origin, or
	// one talking to several APIs whose gateways write whole URLs themselves.
	it("answers the path as written, with nothing in front of it", () => {
		expect(new BareGateway().at()).toBe("/todos");
		expect(new BareGateway().at("42")).toBe("/todos/42");
	});

	it("still lets a method name a whole URL of its own", () => {
		expect(new BareGateway().at("https://other.api/v1/health")).toBe(
			"https://other.api/v1/health",
		);
	});
});
