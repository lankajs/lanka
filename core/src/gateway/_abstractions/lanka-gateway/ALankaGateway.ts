import type { TLankaRequestInit } from "../../_types/TLankaRequestInit";
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
import { lankaStandardValidator } from "../../../validation/lanka-standard-validator/lankaStandardValidator";
import type { ILankaValidator } from "../../../validation/lanka-standard-validator/lankaStandardValidator";

export abstract class ALankaGateway<TOptions = TLankaRequestInit> {
	protected requestExecutor: ILankaRequest<TOptions>;
	protected queryParamsHandler: TLankaQueryBuilder;

	/**
	 * The validator a method checks a response body with.
	 *
	 * `config.validationService` when one was given, the Standard Schema port
	 * otherwise. It used to be accepted by the config and read by nothing: a
	 * consumer handing a test double to the gateway got the real validator and no
	 * error, which is the worst kind of ignored option — it looks honoured.
	 */
	protected readonly validationService: ILankaValidator;

	protected readonly useMock: boolean;
	protected readonly basePath: string;

	protected constructor(config: IALankaGatewayConfig<TOptions>) {
		lankaLogger.printGatewayLog("Create gateway", this);
		const flags = getLankaFlags();
		this.useMock = config.useMock ?? flags.isMockMode ?? false;
		this.validationService = config.validationService ?? lankaStandardValidator;

		// A gateway with nothing said about transport talks JSON over `fetch`, which
		// is what almost every one of them does. Supplying a request is how a gateway
		// stops being ordinary — a raw `Response`, a multipart upload, a transport
		// that never leaves the process — and that stays a decision rather than a
		// line every gateway has to carry to be born.
		// The cast covers the FRAMEWORK picking its own fallback, and nothing a
		// consumer does. `TOptions` is unconstrained here on purpose — a gateway may
		// front a request that never speaks HTTP, and the port promises exactly that
		// — so the JSON default cannot be proven to fit a `TOptions` nobody has
		// named yet. A consumer whose options are not fetch-shaped supplies
		// `request`, and this line never runs for them.
		this.requestExecutor = config.request ?? new LankaFetchJsonRequest();

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

		// A path already under the base is one this method produced, and it is
		// returned as it is: `endpoint()` is idempotent. `request()` resolves
		// through `endpoint()`, and every gateway in the guide hands it
		// `this.endpoint(…)`, so each call resolves twice. An absolute base hides
		// that — the first pass makes an absolute URL — and a RELATIVE one (`/api`)
		// sent every request to `/api/api/…` (issue #7).
		//
		// Decided on the INPUT, before `basePath` is joined, and not on the joined
		// result: a gateway whose `basePath` happens to start with the base's
		// segment then resolves exactly as it always did, and only an argument that
		// already carries the base is left alone. The one reading given up: a path
		// written as `/api/x` under a base of `/api` means `/api/x`.
		const base = withoutTrailingSlashes(getLankaHost().apiBaseUrl);
		if (base && isUnder(path, base)) return path;

		return withApiBase(base, this.resolvePath(path));
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
 * join. The base is passed in rather than read: `endpoint()` has already read
 * it, and the host is not asked twice per request.
 */
function withApiBase(base: string, path: string): string {
	if (!base) return path;
	if (!path) return base;

	return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}

/**
 * The base itself, or a path below it — compared as a whole segment.
 *
 * `/api-keys` starts with `/api` and is not under it; a bare `startsWith` would
 * take it for already-prefixed and drop the base from a real request.
 */
function isUnder(path: string, base: string): boolean {
	if (!path.startsWith(base)) return false;

	const next = path.charAt(base.length);
	return next === "" || next === "/" || next === "?";
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
