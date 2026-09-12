/**
 * One failure shape for every layer.
 *
 * `handleLankaApiError` normalises a response body. Parsing a SPECIFIC backend
 * format is policy and belongs to `@lankajs/plugin-http`.
 */

export { LankaError } from "./lanka-error/LankaError";
export type { ILankaErrorInit, TLankaErrorKind } from "./lanka-error/LankaError";
export { createLankaApiError } from "./_factories/create-lanka-api-error/createLankaApiError";
export { handleLankaApiError } from "./handle-lanka-api-error/handleLankaApiError";
export { readLankaFieldErrors } from "./read-lanka-field-errors/readLankaFieldErrors";
export type { ILankaApiError } from "./_interfaces/ILankaApiError";
export type { ILankaFieldError } from "./_interfaces/ILankaFieldError";
export type { TLankaErrorHandler } from "./_types/TLankaErrorHandler";
