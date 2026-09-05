import type { ILankaValidator } from "../../validation/lanka-standard-validator/lankaStandardValidator";
import type { ILankaRequest } from "./ILankaRequest";
import { TLankaQueryBuilder } from "../_types/TLankaQueryBuilder";

export interface IALankaGatewayConfig<TOptions> {
	/**
	 * The request this gateway sends through. Defaults to `LankaFetchJsonRequest`.
	 *
	 * Each request kind has its own logic — one answers a parsed JSON body, another
	 * the raw `Response`, another uploads multipart — and JSON over `fetch` is what
	 * almost every gateway wants. So it is supplied when the gateway is NOT
	 * ordinary, and omitted otherwise.
	 *
	 * Typed as the PORT: `ALankaRequest` is the convenient implementation, not a
	 * requirement. A consumer with their own transport story supplies their own,
	 * and a test supplies one that never leaves the process.
	 */
	request?: ILankaRequest<TOptions>;
	/** Base API path for this gateway, e.g. "/admin/company" */
	basePath?: string;
	/**
	 * Serialises query parameters for every request of this gateway.
	 *
	 * An error-body handler does NOT belong here: it is given to the request —
	 * `new LankaFetchJsonRequest({ errorHandler })` — which is the only layer that
	 * reads it.
	 */
	queryParamsHandler?: TLankaQueryBuilder;
	/**
	 * The validator a method checks a response body with. Defaults to
	 * `lankaStandardValidator`.
	 *
	 * Reachable as `this.validationService` in a class and as
	 * `validationService` in the functional context. A test hands one that
	 * records what it was asked; a migration hands one that accepts a shape the
	 * new schema does not yet.
	 */
	validationService?: ILankaValidator;
	/**
	 * Enable mock mode. If undefined, reads from infrastructure flags (isMockMode).
	 * If true, mock handlers passed to request methods will be used instead of real requests.
	 */
	useMock?: boolean;
}
