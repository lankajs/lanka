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
export const DOM_TS_TESTS: string[] = ["src/errors/handle-lanka-api-error/handleLankaApiError.test.ts"];

/**
 * Two entries were removed when core stopped rendering, and one pair was already
 * wrong before that.
 *
 * The render-optimisation specs moved to `@lankajs/react`: they measure a
 * BINDING, and core has no binding any more. The two `ALankaGateway` paths named
 * `src/gateway/lanka-gateway/…`, and the files have lived in
 * `src/gateway/_abstractions/lanka-gateway/…` for long enough that nobody
 * noticed — an exclude that matches nothing excludes nothing, so both ran in the
 * node project all along and passed, which is why it stayed invisible.
 *
 * The lesson is the one `skills/gates/SKILL.md` §6 already states: a path filter
 * that can match nothing is a filter nobody can tell is broken. The counts in a
 * run are the cheap second reading — this list shrank from five to one, and the
 * suite's file count is what has to be checked against it.
 */
