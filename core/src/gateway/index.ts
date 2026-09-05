/**
 * Transport and its extension points.
 *
 * Three layers — gateway → request kind → transport — so a consumer can replace
 * the way bytes travel without touching a gateway.
 *
 * ONE transport ships, and that is deliberate. `ILankaTransport` is the seam for
 * a different PROTOCOL — a native bridge, a socket, a double that never leaves
 * the process. Body encoding is not a protocol: `LankaFetchTransport` decides it
 * per call by looking at the body, so a gateway posts `FormData` to one endpoint
 * and an object to the next. Policy around a request — credentials, static
 * headers, CSRF, retry, auth refresh, idempotency, deadlines — is middleware, and
 * `@lankajs/plugin-http` is where it lives.
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
export { LankaFetchTransport } from "./lanka-fetch-transport/LankaFetchTransport";
export { buildLankaQueryParams } from "./_utils/build-lanka-query-params/buildLankaQueryParams";
export { lankaHttpInFlight } from "./inflight/lankaHttpInFlight";
export type {
	ILankaRequestContext,
	TLankaRequestMiddleware,
} from "./request/lankaRequestMiddleware";
export type { TLankaExecuteOptions } from "./_types/TLankaExecuteOptions";
export type { TLankaRequestInit } from "./_types/TLankaRequestInit";
export type { ILankaRequest } from "./_interfaces/ILankaRequest";
export type { ILankaInFlightCounter } from "./inflight/lankaHttpInFlight";

export type { IALankaGatewayConfig } from "./_interfaces/IALankaGatewayConfig";
export type { ILankaListQueryParams } from "./_interfaces/ILankaListQueryParams";
export type { ILankaTransport } from "./_interfaces/ILankaTransport";
export type { TLankaQueryBuilder } from "./_types/TLankaQueryBuilder";
export type { TLankaQueryParams } from "./_types/TLankaQueryParams";
