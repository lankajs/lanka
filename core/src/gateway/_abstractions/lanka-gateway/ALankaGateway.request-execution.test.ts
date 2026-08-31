import { describe, it, expect, vi, beforeEach } from "vitest";
import { ALankaGateway } from "./ALankaGateway";
import type { IALankaGatewayConfig } from "../../_interfaces/IALankaGatewayConfig";
import { ALankaRequest } from "../../request/_abstractions/lanka-request/ALankaRequest";
import type { ILankaListQueryParams } from "../../_interfaces/ILankaListQueryParams";
import { TLankaQueryBuilder } from "../../_types/TLankaQueryBuilder";
import { createLanka } from "../../../bootstrap/_factories/create-lanka/createLanka";
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
	public _listQuery(params: ILankaListQueryParams) {
		return this.buildQueryParams(params);
	}
	public _setListQueryBuilder(builder: TLankaQueryBuilder) {
		this.setQueryParamsHandler(builder);
	}
	public _setRequest(req: ALankaRequest<TReqOptions>) {
		this.setRequest(req);
	}
}

describe("ALankaGateway — request()", () => {
	let request: FakeRequest;
	let lanka: ILankaInstance;

	beforeEach(() => {
		request = new FakeRequest();
		vi.clearAllMocks();
		resetActiveLanka();
		lanka = createLanka({ host: gatewayTestHost });
		lanka.activate();
	});

	it("calls requestExecutor.execute with resolved endpoint, options, mockHandler", async () => {
		const gw = new TestGateway({ request, basePath: "/admin/company" });

		const mockHandler = vi.fn(async () => ({ ok: "mock" }));
		const options = { method: "GET" as const };

		await gw._request("1/user", options, mockHandler);

		expect(request.requestFn).toHaveBeenCalledTimes(1);
		expect(request.requestFn).toHaveBeenCalledWith(
			"/admin/company/1/user",
			options,
			mockHandler,
		);
	});

	it("works with query-only path", async () => {
		const gw = new TestGateway({ request, basePath: "/admin/company" });

		await gw._request("?page=2", { method: "GET" });

		expect(request.requestFn).toHaveBeenCalledWith(
			"/admin/company?page=2",
			{ method: "GET" },
			undefined,
		);
	});
});

describe("ALankaGateway — listQuery() + setListQueryBuilder()", () => {
	let request: FakeRequest;
	let lanka: ILankaInstance;

	beforeEach(() => {
		request = new FakeRequest();
		vi.clearAllMocks();
		resetActiveLanka();
		lanka = createLanka({ host: gatewayTestHost });
		lanka.activate();
	});

	it("uses default/provided listQueryBuilder", () => {
		const builder = vi.fn<TLankaQueryBuilder>(() => new URLSearchParams({ a: "1" }));
		const gw = new TestGateway({
			request,
			basePath: "/api",
			queryParamsHandler: builder,
		});

		const params: ILankaListQueryParams = { page: 1, limit: 10 };
		const sp = gw._listQuery(params);

		expect(builder).toHaveBeenCalledWith(params);
		expect(sp.get("a")).toBe("1");
	});

	it("can replace listQueryBuilder at runtime", () => {
		const builder1 = vi.fn<TLankaQueryBuilder>(() => new URLSearchParams({ a: "1" }));
		const builder2 = vi.fn<TLankaQueryBuilder>(() => new URLSearchParams({ b: "2" }));

		const gw = new TestGateway({
			request,
			basePath: "/api",
			queryParamsHandler: builder1,
		});

		expect(gw._listQuery({ page: 1, limit: 10 }).get("a")).toBe("1");

		gw._setListQueryBuilder(builder2);
		expect(gw._listQuery({ page: 2, limit: 10 }).get("b")).toBe("2");

		expect(builder1).toHaveBeenCalled();
		expect(builder2).toHaveBeenCalled();
	});
});

describe("ALankaGateway — setRequest()", () => {
	it("can replace request executor at runtime", async () => {
		const req1 = new FakeRequest();
		const req2 = new FakeRequest();

		const gw = new TestGateway({ request: req1, basePath: "/api" });

		await gw._request("x");
		expect(req1.requestFn).toHaveBeenCalledTimes(1);
		expect(req2.requestFn).toHaveBeenCalledTimes(0);

		gw._setRequest(req2);
		await gw._request("x");
		expect(req1.requestFn).toHaveBeenCalledTimes(1);
		expect(req2.requestFn).toHaveBeenCalledTimes(1);
	});
});
