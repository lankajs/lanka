/**
 * The `.test.ts` files of this package that need a real DOM.
 *
 * `vitest.config.ts` splits the suite into two projects because building a jsdom
 * per file is the most expensive line item, and most of these files touch no DOM
 * global. Every `.test.tsx` goes to the `dom` project by extension; listed here
 * are the `.ts` files whose subject reaches for `window`, `document`,
 * `navigator` or `localStorage`.
 *
 * Forgetting to add a file is not a silent degradation: the test fails with
 * `document is not defined` and the run goes red. This list can only be wrong in
 * the direction that makes noise.
 */
export const DOM_TS_TESTS: string[] = [
	"src/gateway/lanka-gateway/ALankaGateway.endpoint-resolution.test.ts",
	"src/gateway/lanka-gateway/ALankaGateway.request-execution.test.ts",
	"src/errors/handle-lanka-api-error/handleLankaApiError.test.ts",
	"src/viewmodel/_factories/create-shared-store-lanka-vm/createSharedStoreLankaVM.render-optimization.test.ts",
	"src/viewmodel/_factories/create-lanka-vm/createLankaVM.renderOptimization.test.ts",
];
