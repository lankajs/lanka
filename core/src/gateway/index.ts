/**
 * Transport and its extension points.
 *
 * Three layers — gateway → request strategy → transport — so a consumer can
 * replace the transport wholesale (CSRF, cookies) without touching a gateway.
 *
 * `lankaHttpInFlight` is public on purpose: it is the extension point
 * `@lankajs/plugin-prefetch` builds on. The priority ladder
 * `SSE > plain request > route chunk > prefetch` is only enforceable against an
 * observable counter.
 */

export { ALankaGateway } from "./_abstractions/lanka-gateway/ALankaGateway";
export { createLankaGateway } from "./_factories/create-lanka-gateway/createLankaGateway";
export type { ILankaGatewayConfig } from "./_factories/create-lanka-gateway/createLankaGateway";
export type { ILankaGatewayContext } from "./_interfaces/ILankaGatewayContext";
export { ALankaRequest } from "./request/_abstractions/lanka-request/ALankaRequest";
export { LankaFetchRequest } from "./request/lanka-fetch-request/LankaFetchRequest";
export { createLankaFetchRequest } from "./request/_factories/create-lanka-fetch-request/createLankaFetchRequest";
export { LankaFetchJsonRequest } from "./request/lanka-fetch-json-request/LankaFetchJsonRequest";
export { createLankaFetchJsonRequest } from "./request/_factories/create-lanka-fetch-json-request/createLankaFetchJsonRequest";
export { LankaFetchFormDataRequest } from "./request/lanka-fetch-form-data-request/LankaFetchFormDataRequest";
export { createLankaFetchFormDataRequest } from "./request/_factories/create-lanka-fetch-form-data-request/createLankaFetchFormDataRequest";
export { LankaFetchTransport } from "./transport/lanka-fetch-transport/LankaFetchTransport";
export { LankaFetchJsonTransport } from "./transport/lanka-fetch-json-transport/LankaFetchJsonTransport";
export { LankaFetchFormDataTransport } from "./transport/lanka-fetch-form-data-transport/LankaFetchFormDataTransport";
export { buildLankaQueryParams } from "./_utils/build-lanka-query-params/buildLankaQueryParams";
export { lankaHttpInFlight } from "./inflight/lankaHttpInFlight";
export type {
	ILankaRequestContext,
	TLankaRequestMiddleware,
} from "./request/lankaRequestMiddleware";
export type { TLankaExecuteOptions } from "./_types/TLankaExecuteOptions";
export type { ILankaRequest } from "./_interfaces/ILankaRequest";
export type { ILankaInFlightCounter } from "./inflight/lankaHttpInFlight";

export type { IALankaGatewayConfig } from "./_interfaces/IALankaGatewayConfig";
export type { ILankaListQueryParams } from "./_interfaces/ILankaListQueryParams";
export type { ILankaTransport } from "./_interfaces/ILankaTransport";
export type { TLankaQueryBuilder } from "./_types/TLankaQueryBuilder";
export type { TLankaQueryParams } from "./_types/TLankaQueryParams";
