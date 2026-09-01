import type { IALankaGatewayConfig } from "../../_interfaces/IALankaGatewayConfig";
import { lankaLogger } from "../../../logger/lanka-logger/LankaLogger";
import { LankaFetchJsonRequest } from "../../request/lanka-fetch-json-request/LankaFetchJsonRequest";
import type { ILankaRequest } from "../../_interfaces/ILankaRequest";
import type { TLankaExecuteOptions } from "../../_types/TLankaExecuteOptions";
import { buildLankaQueryParams } from "../../_utils/build-lanka-query-params/buildLankaQueryParams";
import { TLankaQueryParams } from "../../_types/TLankaQueryParams";
import { TLankaQueryBuilder } from "../../_types/TLankaQueryBuilder";
import { getLankaFlags } from "../../../config/get-lanka-flags/getLankaFlags";
import { getLankaHost } from "../../../config/get-lanka-host/getLankaHost";

export abstract class ALankaGateway<TOptions = RequestInit> {
	protected requestExecutor: ILankaRequest<TOptions>;
	protected queryParamsHandler: TLankaQueryBuilder;

	protected readonly useMock: boolean;
	protected readonly basePath: string;

	protected constructor(config: IALankaGatewayConfig<TOptions>) {
		lankaLogger.printGatewayLog("Create gateway", this);
		const flags = getLankaFlags();
		this.useMock = config.useMock ?? flags.isMockMode ?? false;

		// A gateway with nothing said about transport talks JSON over `fetch`, which
		// is what almost every one of them does. Supplying a request is how a gateway
		// stops being ordinary — a raw `Response`, a multipart upload, a transport
		// that never leaves the process — and that stays a decision rather than a
		// line every gateway has to carry to be born.
		this.requestExecutor = config.request ?? new LankaFetchJsonRequest<TOptions>();

		this.basePath = config.basePath ?? "";
		this.queryParamsHandler = config.queryParamsHandler ?? buildLankaQueryParams;
	}

	/**
	 * Resolves endpoint for request.
	 * - Absolute paths (starting with "/") are returned as-is
	 * - Relative paths are joined with basePath
	 * - Query-only strings like "?a=1" are attached to basePath
	 */
	protected endpoint(path: string = ""): string {
		// An absolute URL is detected BEFORE joining with `basePath`, not after:
		// otherwise `https://other.host/health` first becomes
		// `/things/https://other.host/health` and there is nothing left to detect.
		if (isAbsoluteUrl(path)) return path;

		return this.withApiBase(this.resolvePath(path));
	}

	/**
	 * Joins `basePath` and the method path.
	 */
	private resolvePath(path: string): string {
		if (!path) return this.basePath;

		if (path.startsWith("/")) return path;

		if (path.startsWith("?")) return `${this.basePath}${path}`;

		// No leading-slash case here: the check above already returned for one, so
		// stripping it again was a branch no input could take — uncoverable by
		// construction, and it counted against the coverage floor that gates this
		// package.
		const left = this.basePath.endsWith("/") ? this.basePath.slice(0, -1) : this.basePath;
		return `${left}/${path}`;
	}

	/**
	 * Prefixes the API base URL from the host contract.
	 *
	 * Here rather than in every consumer: otherwise each consumer knows the URL
	 * and the framework does not, and a realtime plugin would have to know a
	 * specific application's build.
	 *
	 * Declaring the field and not using it would be worse than not declaring it: a
	 * declaration nothing is built from is a second truth, free to diverge from
	 * the first.
	 *
	 * An absolute URL never reaches here — `endpoint()` filters it out before the
	 * join.
	 */
	private withApiBase(path: string): string {
		const base = withoutTrailingSlashes(getLankaHost().apiBaseUrl);
		if (!base) return path;
		if (!path) return base;

		return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
	}

	protected buildQueryParams<T extends object>(params: T): URLSearchParams {
		return this.queryParamsHandler(params as Record<string, TLankaQueryParams>);
	}

	protected async request<TReturn = unknown>(
		path: string,
		options?: TLankaExecuteOptions<TOptions>,
		mockHandler?: () => Promise<TReturn>,
	): Promise<TReturn> {
		return this.requestExecutor.execute<TReturn>(this.endpoint(path), options, mockHandler);
	}

	/**
	 * Allows to replace request implementation at runtime (e.g. feature flags / tests).
	 * If you prefer static customization - override `request()` in a subclass.
	 */
	protected setRequest(request: ILankaRequest<TOptions>): void {
		this.requestExecutor = request;
	}

	protected setQueryParamsHandler(handler: TLankaQueryBuilder): void {
		this.queryParamsHandler = handler;
	}
}

/**
 * A scheme plus `//` — a URL that already knows where it is going.
 *
 * A standalone function rather than a method: it is not about a particular
 * gateway, and `endpoint()` needs it before any joining.
 */
function isAbsoluteUrl(path: string): boolean {
	// The cheap half first: a scheme needs `://`, and `includes` answers without
	// starting the regex engine. Every relative path an application writes — which
	// is nearly all of them — stops on this line.
	if (!path.includes("://")) return false;

	return /^[a-z][a-z\d+\-.]*:\/\//i.test(path);
}

/**
 * The API base without its trailing slashes, remembered between calls.
 *
 * The host answers the same string for the life of an application, and trimming
 * it is a regex replace otherwise run on every endpoint of every request. One
 * entry is enough: there is one active host, and a second framework in the same
 * process simply replaces what is remembered here.
 */
let lastRawBase: string | null = null;
let lastTrimmedBase = "";

function withoutTrailingSlashes(base: string): string {
	if (base !== lastRawBase) {
		lastRawBase = base;
		lastTrimmedBase = base.replace(/\/+$/, "");
	}

	return lastTrimmedBase;
}
