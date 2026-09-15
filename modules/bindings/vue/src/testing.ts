/**
 * `@lankajs/vue/testing` — rendering a Vue tree with a bootstrapped framework.
 *
 * A separate entry because the library it needs is one a consumer should not be
 * asked to install in order to ship an application: `@testing-library/vue` is an
 * OPTIONAL peer, and an import of this subpath is what makes it required.
 *
 * The same shape as `@lankajs/react/testing`, and deliberately so: a consumer
 * moving a suite between frameworks changes the import and the component, not
 * the way a test is written.
 */

export { renderWithLanka } from "./render-with-lanka/renderWithLanka";
export type {
	IRenderWithLankaOptions,
	IRenderWithLankaResult,
} from "./render-with-lanka/renderWithLanka";
