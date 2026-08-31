/**
 * Development without a backend.
 *
 * The seam lives in core because it depends on how `ALankaGateway` accepts
 * `mockHandler`.
 *
 * `createLankaMockHandler` returns `undefined` outside mock mode, which is what
 * lets the bundler drop both the handler and the mocks it imports from a
 * production build.
 */

export { createLankaMockHandler } from "./_factories/create-lanka-mock-handler/createLankaMockHandler";
