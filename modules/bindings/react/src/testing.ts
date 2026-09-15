"use client";

/**
 * `@lankajs/react/testing` — rendering a React tree with a bootstrapped framework.
 *
 * A separate entry because the library it needs is one a consumer should not be
 * asked to install in order to ship an application: `@testing-library/react` is
 * an OPTIONAL peer, and an import of this subpath is what makes it required.
 *
 * It lived in `@lankajs/tool-testing` until the shelf existed, and moving it is
 * the point rather than tidiness — the kit depends on `lanka` and nothing else,
 * so a kit that also depended on a UI framework was the one package that could
 * not honestly say which framework an application uses.
 */

export { renderWithLanka } from "./render-with-lanka/renderWithLanka";
export type {
	IRenderWithLankaOptions,
	IRenderWithLankaResult,
} from "./render-with-lanka/renderWithLanka";
